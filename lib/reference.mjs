import { readFileSync } from 'node:fs';

const referenceArticles = JSON.parse(readFileSync(new URL('../content/reference-articles.json', import.meta.url), 'utf8'));

export function referenceList(db) {
  return referenceArticles.map(article => ({ ...article, imported: !!existingArticle(db, article) }));
}

function existingArticle(db, article) {
  const marker = db.prepare('SELECT value FROM meta WHERE key=?').get(`reference:${article.id}`);
  if (marker && db.prepare('SELECT id FROM articles WHERE id=?').get(marker.value)) return true;
  return db.prepare('SELECT id FROM articles WHERE title=?').get(article.title);
}

export function importReferences(db, ids) {
  if (!Array.isArray(ids) || !ids.length || ids.length > referenceArticles.length || ids.some(id => typeof id !== 'string' || !referenceArticles.some(article => article.id === id))) throw new Error('请选择有效的参考文章');
  let imported = 0;
  db.exec('BEGIN');
  try {
    for (const id of new Set(ids)) {
      const article = referenceArticles.find(article => article.id === id);
      if (existingArticle(db, article)) continue;
      const result = db.prepare('INSERT INTO articles(title,category,summary,content,updated) VALUES (?,?,?,?,?)').run(article.title, article.category, article.summary, article.content, new Date().toISOString());
      db.prepare('INSERT OR REPLACE INTO meta(key,value) VALUES (?,?)').run(`reference:${id}`, String(result.lastInsertRowid));
      imported++;
    }
    db.exec('COMMIT');
    return imported;
  } catch (error) { db.exec('ROLLBACK'); throw error; }
}
