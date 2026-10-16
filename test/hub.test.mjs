import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname, basename } from 'node:path';
import { once } from 'node:events';
import { createApp } from '../server.mjs';
import { openStore, passwordHash, passwordMatches } from '../lib/store.mjs';

async function fixture(t,secureCookies=false) {
  const dataDir=mkdtempSync(join(tmpdir(),'cimai-test-'));
  const app=createApp({dataDir,secureCookies});
  app.db.prepare("INSERT INTO users(username,name,password,role) VALUES (?,?,?,'admin')").run('admin','管理员',passwordHash('Admin-test-password-123'));
  app.server.listen(0,'127.0.0.1');await once(app.server,'listening');
  const base=`http://127.0.0.1:${app.server.address().port}`;
  t.after(async()=>{
    if(app.server.listening){app.server.closeAllConnections();await new Promise(resolve=>app.server.close(resolve));}
    // Only remove the dedicated directory created by this fixture.
    assert.equal(dirname(resolve(dataDir)),resolve(tmpdir()));assert.match(basename(dataDir),/^cimai-test-/);
    rmSync(dataDir,{recursive:true,force:true});
  });
  async function request(path,method='GET',data,cookie='',headers={}) {
    const response=await fetch(`${base}/api/${path}`,{method,headers:{...(data===undefined?{}:{'Content-Type':'application/json'}),...(cookie?{Cookie:cookie}:{}),...headers},body:data===undefined?undefined:JSON.stringify(data)});
    return {status:response.status,body:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0],headers:response.headers};
  }
  const login=(username='admin',password='Admin-test-password-123')=>request('login','POST',{username,password});
  return {...app,dataDir,request,login,base};
}

test('访客只能浏览公开文章，不能查看或修改项目与账号',async t=>{
  const f=await fixture(t);
  const articles=await f.request('articles');assert.equal(articles.status,200);assert.equal(articles.body.length,3);
  for(const path of ['projects','users'])assert.equal((await f.request(path)).status,401);
  assert.equal((await f.request('projects','POST',{title:'secret'})).status,401);
  assert.equal((await f.request('articles','POST',{})).status,401);
  assert.equal((await fetch(`${f.base}/data/hub.sqlite`)).status,404);
  assert.equal((await fetch(`${f.base}/../package.json`)).status,404);
  const page=await fetch(f.base);assert.equal(page.status,200);assert.match(await page.text(),/磁脉知识库/);
  assert.match(page.headers.get('content-security-policy'),/frame-ancestors 'none'/);
});

test('公网 HTTP 配置拒绝员工登录和项目接口',async t=>{
  const f=await fixture(t,true);
  assert.equal((await f.request('articles')).status,200);
  assert.equal((await f.login()).status,426);
  assert.equal((await f.request('projects')).status,426);
  assert.equal((await f.request('me')).body.loginAvailable,false);
  const viaProxy=await f.request('login','POST',{username:'admin',password:'Admin-test-password-123'},'',{'X-Forwarded-Proto':'https'});
  assert.equal(viaProxy.status,200);assert.match(viaProxy.headers.get('set-cookie'),/; Secure/);
});

test('管理员开通员工，员工维护项目但不能修改公开内容或管理账号',async t=>{
  const f=await fixture(t);const admin=(await f.login()).cookie;
  assert.equal((await f.request('users','POST',{username:'member',name:'员工甲',password:'Member-password-123'},admin)).status,201);
  const member=(await f.login('member','Member-password-123')).cookie;
  const project={title:'测试项目',description:'下一步：确认方案',owner:'员工甲',deadline:'2026-12-01',status:'planned'};
  assert.equal((await f.request('projects','POST',project,member)).status,200);
  let projects=(await f.request('projects','GET',undefined,member)).body;assert.equal(projects.length,1);
  const id=projects[0].id;
  assert.equal((await f.request(`projects/${id}`,'PUT',{...project,status:'done'},member)).status,200);
  projects=(await f.request('projects','GET',undefined,admin)).body;assert.equal(projects[0].status,'done');assert.equal(projects[0].updated_by,'员工甲');
  assert.equal((await f.request(`projects/${id}`,'DELETE',{},member)).status,403);
  assert.equal((await f.request('users','GET',undefined,member)).status,403);
  assert.equal((await f.request('articles','POST',{},member)).status,403);
  assert.equal((await f.request(`projects/${id}`,'DELETE',{},admin)).status,200);
});

test('公开文章发布、编辑、删除，以及 SQLite 重启后持久化',async t=>{
  const f=await fixture(t);const admin=(await f.login()).cookie;
  const article={title:'真实文章',category:'技术',summary:'摘要',content:'第一段\n第二段 <script>alert(1)</script>'};
  assert.equal((await f.request('articles','POST',article,admin)).status,200);
  let articles=(await f.request('articles')).body;const id=articles.find(a=>a.title==='真实文章').id;
  assert.equal((await f.request(`articles/${id}`,'PUT',{...article,title:'更新后的文章'},admin)).status,200);
  f.server.closeAllConnections();await new Promise(resolve=>f.server.close(resolve));
  const reopened=openStore(f.dataDir);
  assert.equal(reopened.prepare('SELECT title FROM articles WHERE id=?').get(id).title,'更新后的文章');
  assert.equal(reopened.prepare('SELECT COUNT(*) AS count FROM articles').get().count,4);
  reopened.prepare('DELETE FROM articles WHERE id=?').run(id);reopened.close();
});

test('退出、停用账号、重设密码会立即撤销会话',async t=>{
  const f=await fixture(t);const admin=(await f.login()).cookie;
  await f.request('users','POST',{username:'member',name:'员工甲',password:'Member-password-123'},admin);
  const member=(await f.login('member','Member-password-123')).cookie;
  const id=(await f.request('users','GET',undefined,admin)).body.find(u=>u.username==='member').id;
  await f.request(`users/${id}`,'PUT',{active:false},admin);
  assert.equal((await f.request('projects','GET',undefined,member)).status,401);
  assert.equal((await f.login('member','Member-password-123')).status,401);
  await f.request(`users/${id}`,'PUT',{active:true,password:'Replacement-password-123'},admin);
  assert.equal((await f.login('member','Member-password-123')).status,401);
  const fresh=(await f.login('member','Replacement-password-123')).cookie;
  assert.equal((await f.request('projects','GET',undefined,fresh)).status,200);
  await f.request('logout','POST',{},fresh);
  assert.equal((await f.request('projects','GET',undefined,fresh)).status,401);
  assert.equal((await f.request('users/1','PUT',{active:false},admin)).status,400);
});

test('同源限制、输入校验和密码策略',async t=>{
  const f=await fixture(t);const admin=(await f.login()).cookie;
  assert.equal((await f.request('users','POST',{},admin,{Origin:'https://other.example'})).status,403);
  assert.equal((await f.request('users','POST',{},admin,{'Sec-Fetch-Site':'cross-site'})).status,403);
  assert.equal((await f.request('users','POST',{username:'valid',name:'员工',password:'123'},admin)).status,400);
  assert.equal((await f.request('projects','POST',{title:'项目',description:'',owner:'甲',deadline:'2026-02-30',status:'planned'},admin)).status,400);
  assert.equal((await f.request('projects','POST',{title:'项目',description:'',owner:'甲',deadline:'',status:'invalid'},admin)).status,400);
  assert.equal((await f.request('articles','POST',{title:'x',category:'x',summary:'x',content:'x'.repeat(140000)},admin)).status,413);
  const hash=passwordHash('  spaces-password-123  ');assert.equal(passwordMatches('  spaces-password-123  ',hash),true);assert.equal(passwordMatches('different',hash),false);
  assert.equal(hash.includes('spaces-password'),false);
  const stored=f.db.prepare('SELECT password FROM users WHERE id=1').get().password;
  assert.notEqual(stored,'Admin-test-password-123');
  const accountData=(await f.request('users','GET',undefined,admin)).body;assert.equal('password' in accountData[0],false);
});

test('登录失败达到上限后限流',async t=>{
  const f=await fixture(t);
  for(let i=0;i<8;i++)assert.equal((await f.login('admin','wrong-password')).status,401);
  assert.equal((await f.login()).status,429);
});

test('过期和伪造会话无效，密码空格不会被截去',async t=>{
  const f=await fixture(t);const admin=(await f.login()).cookie;
  assert.equal((await f.request('projects','GET',undefined,`hub_session=${'a'.repeat(64)}`)).status,401);
  f.db.prepare('UPDATE sessions SET expires=0').run();
  assert.equal((await f.request('projects','GET',undefined,admin)).status,401);
  f.db.prepare("INSERT INTO users(username,name,password,role) VALUES (?,?,?,'member')").run('spaced','空格密码',passwordHash('  valid-password-123  '));
  assert.equal((await f.login('spaced','  valid-password-123  ')).status,200);
  assert.equal((await f.login('spaced','valid-password-123')).status,401);
});

test('备份生成可独立打开并包含完整记录的数据库',async t=>{
  const f=await fixture(t);
  const {backup,DatabaseSync}=await import('node:sqlite');
  const path=join(f.dataDir,'verified-backup.sqlite');
  await backup(f.db,path);
  const copy=new DatabaseSync(path);assert.equal(copy.prepare('PRAGMA integrity_check').get().integrity_check,'ok');assert.equal(copy.prepare('SELECT COUNT(*) AS n FROM articles').get().n,3);copy.close();
});
