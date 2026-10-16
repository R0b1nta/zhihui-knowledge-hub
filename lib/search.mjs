const fields = "title || ' ' || category || ' ' || summary || ' ' || content || ' ' || owner || ' ' || deadline";

export function searchRecords(db, { query, scope = 'all', page = 1, pageSize = 12, includeProjects = false }) {
  const terms = [...new Set(query.toLowerCase().split(/\s+/u).filter(Boolean))];
  const empty = { query, scope, page, pageSize, total: 0, counts: { article: 0, project: 0 }, results: [], canSearchProjects: includeProjects };
  if (!terms.length) return empty;
  if (scope === 'project' && !includeProjects) return empty;

  const articles = `SELECT id, 'article' AS type, title, category, summary, content, '' AS owner, '' AS status, '' AS deadline, updated FROM articles`;
  const projects = `SELECT id, 'project' AS type, title, '项目空间 · ' || CASE status WHEN 'planned' THEN '待开始' WHEN 'active' THEN '进行中' ELSE '已完成' END AS category, description AS summary, description AS content, owner, status, deadline, updated FROM projects`;
  const sources = scope === 'article' ? articles : scope === 'project' ? projects : `${articles}${includeProjects ? ` UNION ALL ${projects}` : ''}`;
  const where = terms.map(() => `instr(lower(${fields}), ?) > 0`).join(' AND ');
  const prefix = `WITH records AS (${sources})`;
  const counts = { article: 0, project: 0 };
  for (const row of db.prepare(`${prefix} SELECT type, COUNT(*) AS count FROM records WHERE ${where} GROUP BY type`).all(...terms)) counts[row.type] = row.count;
  const score = terms.map(() => '(CASE WHEN instr(lower(title), ?) > 0 THEN 12 ELSE 0 END + CASE WHEN instr(lower(category), ?) > 0 THEN 4 ELSE 0 END + CASE WHEN instr(lower(owner), ?) > 0 THEN 3 ELSE 0 END)').join(' + ');
  const rows = db.prepare(`${prefix} SELECT *, (${score}) + CASE WHEN lower(title) = ? THEN 100 ELSE 0 END AS score FROM records WHERE ${where} ORDER BY score DESC, updated DESC, type ASC, id DESC LIMIT ? OFFSET ?`).all(...terms.flatMap(term => [term, term, term]), query.toLowerCase(), ...terms, pageSize, (page - 1) * pageSize);
  return { ...empty, counts, total: counts.article + counts.project, results: rows.map(({ content, summary, score, ...row }) => ({ ...row, excerpt: excerpt(summary && summary !== content ? `${summary}\n${content}` : content, terms) })) };
}

function excerpt(text, terms) {
  const normalized = text.replace(/\s+/gu, ' ').trim();
  const lower = normalized.toLowerCase();
  const matches = terms.map(term => lower.indexOf(term)).filter(index => index >= 0);
  const start = matches.length ? Math.max(0, Math.min(...matches) - 45) : 0;
  const end = Math.min(normalized.length, start + 190);
  return `${start ? '…' : ''}${normalized.slice(start, end)}${end < normalized.length ? '…' : ''}`;
}
