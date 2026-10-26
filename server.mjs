import http from 'node:http';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { createHash, randomBytes } from 'node:crypto';
import { openStore, passwordHash, passwordMatches } from './lib/store.mjs';
import { searchRecords } from './lib/search.mjs';
import { referenceList, importReferences } from './lib/reference.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const digest = value => createHash('sha256').update(value).digest('hex');
const dummyHash = passwordHash(randomBytes(32).toString('hex'));
const localAddress = address => ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(address);
class RequestError extends Error { constructor(status, message) { super(message); this.status = status; } }
function string(value, name, max, required = true) {
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) throw new RequestError(400, `${name}格式不正确或超过长度限制`);
  return value.trim();
}
function checkPassword(password) {
  if (typeof password !== 'string' || password.length < 12 || password.length > 128) throw new RequestError(400, '密码需要 12–128 个字符');
  return password;
}
export function createApp({ dataDir = process.env.DATA_DIR || join(root, 'data'), secureCookies = true } = {}) {
  const db = openStore(dataDir);
  const attempts = new Map();
  function reply(res, status, value, headers = {}) {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
    res.end(JSON.stringify(value));
  }
  function privateTransport(req) {
    if (!secureCookies || req.socket.encrypted || (localAddress(req.socket.remoteAddress) && req.headers['x-forwarded-proto'] === 'https')) return;
    throw new RequestError(426, '员工登录需要 HTTPS。当前可浏览公开知识库，管理员配置域名与证书后即可开启登录。');
  }
  async function body(req) {
    let size = 0;
    const chunks = [];
    for await (const chunk of req) {
      size += chunk.length;
      if (size > 131072) throw new RequestError(413, '内容过大，请缩短后重试');
      chunks.push(chunk);
    }
    try {
      const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error();
      return parsed;
    } catch { throw new RequestError(400, '请求内容格式不正确'); }
  }
  function currentUser(req) {
    const cookie = /(?:^|;\s*)hub_session=([a-f0-9]{64})(?:;|$)/.exec(req.headers.cookie || '')?.[1];
    if (!cookie) return null;
    return db.prepare('SELECT u.id,u.username,u.name,u.role FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=? AND s.expires>? AND u.active=1').get(digest(cookie), Date.now()) || null;
  }
  function requireUser(req, admin = false) {
    privateTransport(req);
    const user = currentUser(req);
    if (!user) throw new RequestError(401, '请先登录员工账号');
    if (admin && user.role !== 'admin') throw new RequestError(403, '此操作需要管理员权限');
    return user;
  }
  const server = http.createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    if (req.method === 'HEAD') { res.writeHead(200); res.end(); return; }
    try {
      const url = new URL(req.url, 'http://localhost');
      const path = url.pathname;
      const method = req.method;
      if (!['GET','POST','PUT','DELETE'].includes(method)) throw new RequestError(405, '不支持此操作');
      if (method !== 'GET') {
        // Browser writes must be same-origin JSON; cross-origin form posts are rejected.
        if (!String(req.headers['content-type'] || '').startsWith('application/json')) throw new RequestError(415, '需要 JSON 请求');
        if (req.headers['sec-fetch-site'] === 'cross-site') throw new RequestError(403, '不允许跨站提交');
        if (req.headers.origin) {
          let origin;
          try { origin = new URL(req.headers.origin); } catch { throw new RequestError(403, '来源不正确'); }
          if (origin.host !== req.headers.host) throw new RequestError(403, '不允许跨站提交');
        }
      }
      if (path === '/api/health' && method === 'GET') return reply(res, 200, { ok: true });
      if (path === '/api/me' && method === 'GET') {
        let loginAvailable = true;
        try { privateTransport(req); } catch { loginAvailable = false; }
        return reply(res, 200, { user: loginAvailable ? currentUser(req) : null, loginAvailable, configured: !!db.prepare("SELECT id FROM users WHERE active=1 AND role='admin' LIMIT 1").get() });
      }
      if (path === '/api/login' && method === 'POST') {
        privateTransport(req);
        const input = await body(req);
        const username = string(input.username, '账号', 64).toLowerCase();
        if (typeof input.password !== 'string' || !input.password || input.password.length > 128) throw new RequestError(400, '密码格式不正确');
        const password = input.password;
        const remote = req.socket.remoteAddress;
        const peer = localAddress(remote) ? `${remote}:${String(req.headers['x-real-ip'] || remote).slice(0,80)}` : remote;
        const now = Date.now();
        for (const [key, item] of attempts) if (item.until <= now) attempts.delete(key);
        const keys = [`ip:${peer}`, `user:${username}`];
        if (keys.some(key => (attempts.get(key)?.count || 0) >= 8)) throw new RequestError(429, '尝试次数过多，请 15 分钟后重试');
        const user = db.prepare('SELECT * FROM users WHERE username=? AND active=1').get(username);
        if (!passwordMatches(password, user?.password || dummyHash)) {
          for (const key of keys) {
            if (attempts.size >= 10000 && !attempts.has(key)) throw new RequestError(429, '登录繁忙，请稍后重试');
            const item = attempts.get(key) || { count: 0, until: now + 900000 };
            item.count++; attempts.set(key, item);
          }
          throw new RequestError(401, '账号或密码不正确');
        }
        keys.forEach(key => attempts.delete(key));
        db.prepare('DELETE FROM sessions WHERE expires<=?').run(now);
        const token = randomBytes(32).toString('hex');
        db.prepare('INSERT INTO sessions(token,user_id,expires) VALUES (?,?,?)').run(digest(token), user.id, now + 8*3600000);
        return reply(res, 200, { user: { id: user.id, username: user.username, name: user.name, role: user.role } }, { 'Set-Cookie': `hub_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${secureCookies ? '; Secure' : ''}` });
      }
      if (path === '/api/logout' && method === 'POST') {
        const token = /(?:^|;\s*)hub_session=([a-f0-9]{64})(?:;|$)/.exec(req.headers.cookie || '')?.[1];
        if (token) db.prepare('DELETE FROM sessions WHERE token=?').run(digest(token));
        return reply(res, 200, { ok: true }, { 'Set-Cookie': `hub_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secureCookies ? '; Secure' : ''}` });
      }
      if (path === '/api/articles' && method === 'GET') return reply(res, 200, db.prepare('SELECT * FROM articles ORDER BY updated DESC,id DESC').all());
      if (path === '/api/search' && method === 'GET') {
        const query = (url.searchParams.get('q') || '').trim().replace(/\s+/gu, ' ');
        const scope = url.searchParams.get('scope') || 'all';
        const pageText = url.searchParams.get('page') || '1';
        if (query.length > 100 || query.split(' ').length > 8) throw new RequestError(400, '请输入不超过 100 个字符、8 个关键词');
        if (!['all', 'article', 'project'].includes(scope)) throw new RequestError(400, '搜索范围不正确');
        if (!/^[1-9]\d{0,3}$/.test(pageText)) throw new RequestError(400, '页码不正确');
        let includeProjects = false;
        try { privateTransport(req); includeProjects = !!currentUser(req); } catch { /* HTTP visitors only search public articles. */ }
        if (scope === 'project' && !includeProjects) throw new RequestError(401, '请通过 HTTPS 登录后搜索项目');
        return reply(res, 200, searchRecords(db, { query, scope, page: Number(pageText), includeProjects }));
      }
      const articleDetail = /^\/api\/articles\/(\d+)$/.exec(path);
      if (articleDetail && method === 'GET') {
        const article = db.prepare('SELECT * FROM articles WHERE id=?').get(articleDetail[1]);
        if (!article) throw new RequestError(404, '文章已不存在');
        return reply(res, 200, article);
      }
      const articleMatch = /^\/api\/articles(?:\/(\d+))?$/.exec(path);
      if (articleMatch && ['POST','PUT','DELETE'].includes(method)) {
        requireUser(req, true);
        const id = articleMatch[1];
        if (method === 'POST' && id || method !== 'POST' && !id) throw new RequestError(404, '找不到文章');
        if (id && !db.prepare('SELECT id FROM articles WHERE id=?').get(id)) throw new RequestError(404, '文章已不存在');
        if (method === 'DELETE') db.prepare('DELETE FROM articles WHERE id=?').run(id);
        else {
          const input = await body(req);
          const values = [string(input.title,'标题',120),string(input.category,'分类',30),string(input.summary,'摘要',240),string(input.content,'正文',30000),new Date().toISOString()];
          if (id) db.prepare('UPDATE articles SET title=?,category=?,summary=?,content=?,updated=? WHERE id=?').run(...values,id);
          else db.prepare('INSERT INTO articles(title,category,summary,content,updated) VALUES (?,?,?,?,?)').run(...values);
        }
        return reply(res, 200, { ok: true });
      }
      if (path === '/api/projects' && method === 'GET') { requireUser(req); return reply(res,200,db.prepare('SELECT * FROM projects ORDER BY updated DESC,id DESC').all()); }
      const projectDetail = /^\/api\/projects\/(\d+)$/.exec(path);
      if (projectDetail && method === 'GET') {
        requireUser(req);
        const project = db.prepare('SELECT * FROM projects WHERE id=?').get(projectDetail[1]);
        if (!project) throw new RequestError(404, '项目已不存在');
        return reply(res, 200, project);
      }
      const projectMatch = /^\/api\/projects(?:\/(\d+))?$/.exec(path);
      if (projectMatch && ['POST','PUT','DELETE'].includes(method)) {
        const user = requireUser(req, method === 'DELETE');
        const id = projectMatch[1];
        if (method === 'POST' && id || method !== 'POST' && !id) throw new RequestError(404, '找不到项目');
        if (id && !db.prepare('SELECT id FROM projects WHERE id=?').get(id)) throw new RequestError(404, '项目已不存在');
        if (method === 'DELETE') db.prepare('DELETE FROM projects WHERE id=?').run(id);
        else {
          const input = await body(req);
          const deadline = string(input.deadline,'截止日期',10,false);
          if (deadline && (!/^\d{4}-\d{2}-\d{2}$/.test(deadline) || !Number.isFinite(Date.parse(deadline)) || new Date(deadline).toISOString().slice(0,10) !== deadline)) throw new RequestError(400,'截止日期不正确');
          if (!['planned','active','done'].includes(input.status)) throw new RequestError(400,'请选择项目状态');
          const values = [string(input.title,'项目名称',120),string(input.description,'项目说明',5000,false),string(input.owner,'负责人',60),deadline,input.status,new Date().toISOString(),user.name];
          if (id) db.prepare('UPDATE projects SET title=?,description=?,owner=?,deadline=?,status=?,updated=?,updated_by=? WHERE id=?').run(...values,id);
          else db.prepare('INSERT INTO projects(title,description,owner,deadline,status,updated,updated_by) VALUES (?,?,?,?,?,?,?)').run(...values);
        }
        return reply(res,200,{ok:true});
      }
      if (path === '/api/users' && method === 'GET') { requireUser(req,true); return reply(res,200,db.prepare('SELECT id,username,name,role,active FROM users ORDER BY id').all()); }
      if (path === '/api/reference-articles' && method === 'GET') {
        requireUser(req, true);
        return reply(res, 200, referenceList(db));
      }
      if (path === '/api/reference-articles/import' && method === 'POST') {
        requireUser(req, true);
        const input = await body(req);
        try { return reply(res, 200, { imported: importReferences(db, input.ids) }); }
        catch (error) {
          if (error.message === '请选择有效的参考文章') throw new RequestError(400, error.message);
          throw error;
        }
      }
      if (path === '/api/users' && method === 'POST') {
        requireUser(req,true);
        const input = await body(req);
        const username = string(input.username,'账号',64).toLowerCase();
        if (!/^[a-z0-9._-]{3,64}$/.test(username)) throw new RequestError(400,'账号需为 3–64 位字母、数字、点、横线或下划线');
        if (db.prepare('SELECT id FROM users WHERE username=?').get(username)) throw new RequestError(409,'该账号已存在');
        const name = string(input.name,'姓名',60);
        const password = passwordHash(checkPassword(input.password));
        db.prepare("INSERT INTO users(username,name,password,role) VALUES (?,?,?,'member')").run(username,name,password);
        return reply(res,201,{ok:true});
      }
      const userMatch = /^\/api\/users\/(\d+)$/.exec(path);
      if (userMatch && method === 'PUT') {
        const admin = requireUser(req,true);
        const input = await body(req);
        const id = Number(userMatch[1]);
        const target = db.prepare('SELECT id,role FROM users WHERE id=?').get(id);
        if (!target) throw new RequestError(404,'账号不存在');
        const nextPassword = input.password !== undefined ? passwordHash(checkPassword(input.password)) : undefined;
        if (input.active !== undefined) {
          if (typeof input.active !== 'boolean') throw new RequestError(400,'账号状态不正确');
          if (target.role === 'admin' || id === admin.id) throw new RequestError(400,'管理员账号不可在此停用');
          db.prepare('UPDATE users SET active=? WHERE id=?').run(input.active ? 1 : 0,id);
        }
        if (nextPassword !== undefined) db.prepare('UPDATE users SET password=? WHERE id=?').run(nextPassword,id);
        db.prepare('DELETE FROM sessions WHERE user_id=?').run(id);
        return reply(res,200,{ok:true});
      }
      if (path.startsWith('/api/')) throw new RequestError(404,'接口不存在');
      if (method !== 'GET') throw new RequestError(405,'不支持此操作');
      const assets = { '/': ['index.html','text/html; charset=utf-8'], '/home.js': ['home.js','text/javascript; charset=utf-8'], '/home.css': ['home.css','text/css; charset=utf-8'], '/assets/cimai-mountains.jpg': ['assets/cimai-mountains.jpg','image/jpeg','public, max-age=86400'], '/app.js': ['app.js','text/javascript; charset=utf-8'], '/style.css': ['style.css','text/css; charset=utf-8'], '/favicon.svg': ['favicon.svg','image/svg+xml'], '/robots.txt': ['robots.txt','text/plain; charset=utf-8'] };
      const asset = assets[path];
      if (!asset) throw new RequestError(404,'页面不存在');
      res.writeHead(200,{'Content-Type':asset[1],'Cache-Control':asset[2] || 'no-cache'});
      res.end(readFileSync(join(root,'public',asset[0])));
    } catch (error) {
      if (!error.status) console.error('Request failed:', error.message);
      if (!res.headersSent) reply(res,error.status || 500,{error:error.status ? error.message : '服务暂时不可用，请稍后重试'});
      else res.end();
    }
  });
  server.requestTimeout = 15000;
  server.headersTimeout = 10000;
  server.on('close',() => db.close());
  return { server, db };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const host = process.env.HOST || '127.0.0.1';
  const port = Number(process.env.PORT || 3100);
  const secureCookies = process.env.SESSION_SECURE !== '0';
  if (!secureCookies && !localAddress(host)) throw new Error('HTTP 员工登录仅可用于本机预览；公网服务必须启用 HTTPS');
  const { server } = createApp({secureCookies});
  server.listen(port,host,() => console.log(`磁脉知识库 Local: http://${host}:${port}`));
  for (const signal of ['SIGINT','SIGTERM']) process.on(signal,() => server.close(() => process.exit(0)));
}
