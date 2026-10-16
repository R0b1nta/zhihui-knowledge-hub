import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

export function passwordHash(password) {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
}
export function passwordMatches(password, stored) {
  const [salt, hash] = stored.split(':');
  const supplied = scryptSync(password, salt, 64);
  return timingSafeEqual(supplied, Buffer.from(hash, 'hex'));
}
export function openStore(directory) {
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(join(directory, 'hub.sqlite'));
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY, username TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL, password TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin', 'member')),
      active INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id),
      expires INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS articles (
      id INTEGER PRIMARY KEY, title TEXT NOT NULL, category TEXT NOT NULL,
      summary TEXT NOT NULL, content TEXT NOT NULL, updated TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY, title TEXT NOT NULL, description TEXT NOT NULL,
      owner TEXT NOT NULL, deadline TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('planned','active','done')),
      updated TEXT NOT NULL, updated_by TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  `);
  if (!db.prepare("SELECT value FROM meta WHERE key = 'seeded'").get()) {
    const insert = db.prepare('INSERT INTO articles(title,category,summary,content,updated) VALUES (?,?,?,?,?)');
    const updated = new Date().toISOString();
    db.exec('BEGIN');
    try {
      for (const article of [
        ['从这里开始，认识磁脉知识库', '使用指南', '示例文章 · 了解公开知识库与员工项目空间的使用方式。', '这是磁脉知识库的示例文章，供上线前预览。\n\n公开知识库用于分享经过确认、可以对外发布的资料。无需注册，访客即可浏览文章、按分类筛选和搜索。\n\n项目空间需要员工账号登录。管理员开通账号后，成员可以查看和更新团队项目。\n\n正式发布前，请管理员替换示例内容，并确认每篇文章适合公开。'],
        ['如何整理一篇可复用的知识文章', '经验分享', '示例文章 · 从背景、方法到结论，让经验更容易被找到和使用。', '这是一篇使用方法示例，不代表公司的正式制度。\n\n一、写清楚问题\n说明遇到了什么情况，以及文章适用于哪些场景。\n\n二、记录处理方法\n按实际顺序描述关键步骤，保留必要的判断依据。\n\n三、补充结论和边界\n说明最终结果、适用条件，以及下次可以改进的地方。\n\n发布前请删除客户资料、内部报价等不适合公开的信息。'],
        ['项目进展怎么记录更清楚', '项目方法', '示例文章 · 用负责人、日期和状态，记录一件事的当前进展。', '这是基础项目管理的使用示例。\n\n为每个项目填写清楚的名称和目标，并指定一名主要负责人。\n\n在项目说明中记录下一步行动；设置截止日期；按实际进度选择“待开始”“进行中”或“已完成”。\n\n第一版所有已开通账号的员工共享项目空间。涉及限制部分成员访问的项目，请先不要录入，等待后续增加项目成员权限。']
      ]) insert.run(...article, updated);
      db.prepare("INSERT INTO meta(key,value) VALUES ('seeded','1')").run();
      db.exec('COMMIT');
    } catch (error) { db.exec('ROLLBACK'); throw error; }
  }
  return db;
}
