/**
 * probe/schema.js — 数据库表结构探测
 *
 * 给规则文档引用新表时、或通用浏览按钮查询失败时提供诊断。
 */
const db = require('../core/db');

/** 返回表的列定义，查不到返回 null */
async function getTableColumns(tableName) {
  const rows = await db.query(`
    SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = @t
    ORDER BY ORDINAL_POSITION
  `, { t: { type: db.sql.NVarChar, value: tableName } });
  return rows.length ? rows : null;
}

/** 判断表是否存在 */
async function tableExists(tableName) {
  const rows = await db.query(`
    SELECT 1 AS ok FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = @t
  `, { t: { type: db.sql.NVarChar, value: tableName } });
  return rows.length > 0;
}

/** 批量探测：给 AI 调试用 */
async function diagnose(tableNames) {
  const result = {};
  for (const t of tableNames) {
    try {
      const cols = await getTableColumns(t);
      result[t] = cols
        ? cols.map(c => `${c.COLUMN_NAME}(${c.DATA_TYPE})`)
        : 'TABLE_NOT_FOUND';
    } catch (e) {
      result[t] = `ERROR: ${e.message}`;
    }
  }
  return result;
}

module.exports = { getTableColumns, tableExists, diagnose };
