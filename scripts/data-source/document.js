/**
 * data-source/document.js — 文档类数据源
 *
 * 文档字段通常不适合大批量列出，让 AI 让用户提供具体 docid 或通过附件上传生成。
 */
const db = require('../core/db');

async function getDocumentInfo(docid) {
  const rows = await db.query(`
    SELECT id, docsubject, docstatus, doccreaterid, doccreatedate
    FROM docdetail
    WHERE id = @id
  `, { id: { type: db.sql.Int, value: parseInt(docid) } });
  return rows[0] || null;
}

/** 按主题搜索文档（限量，用于 AI 辅助识别） */
async function searchDocuments(keyword, limit = 20) {
  const rows = await db.query(`
    SELECT TOP ${parseInt(limit) || 20}
      id, docsubject, doccreatedate
    FROM docdetail
    WHERE docsubject LIKE @kw AND docstatus < 4
    ORDER BY id DESC
  `, { kw: { type: db.sql.NVarChar, value: `%${keyword}%` } });
  return rows.map(r => ({
    value: String(r.id),
    name: `${r.docsubject} (${r.doccreatedate})`,
    raw: r,
  }));
}

module.exports = { getDocumentInfo, searchDocuments };
