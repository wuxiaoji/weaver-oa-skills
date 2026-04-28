/**
 * data-source/custom-browser.js — 自定义浏览按钮 browser.xxx 查询
 *
 * 通用探测逻辑：
 *   1. 尝试从 mode_browser_related / mode_customsearch 找映射（不同版本表名不同）
 *   2. 没找到就按约定探测 uf_<browserName>
 *   3. 自动识别名称列（projectname/name/mc/xmmc/title/subject 等）
 *   4. 支持 filter 参数（如 zj=4B）
 *
 * 这个查询器是"尽力而为"的，如果查不到，规则文档应该声明具体的 dataSource。
 */
const db = require('../core/db');
const schema = require('../probe/schema');

// 尝试查找名称列的候选（按优先级）
const NAME_COL_CANDIDATES = [
  'name', 'projectname', 'mc', 'xmmc', 'xm',
  'title', 'subject', 'fullname', 'displayname',
  'fylx', 'fybz', // 差旅报销 uf_fybzv1 的特殊情况
];

/**
 * 探测并列出自定义浏览按钮的选项
 * @param {string} browserName 如 'nccyfxm' / 'feiyongbiaozhun1fy'
 * @param {Object} opts { filter: {column: value, ...}, limit, tableHint }
 */
async function probeAndList(browserName, opts = {}) {
  const { filter = {}, limit = 100, tableHint } = opts;

  // 1. 决定要查的表名
  const tableName = tableHint || `uf_${browserName}`;
  if (!await schema.tableExists(tableName)) {
    return {
      items: [],
      error: `table_not_found: ${tableName}`,
      source: null,
    };
  }

  const cols = await schema.getTableColumns(tableName);
  const colNames = cols.map(c => c.COLUMN_NAME);
  const colNamesLower = colNames.map(n => n.toLowerCase());

  // 2. 识别名称列
  const nameCol = NAME_COL_CANDIDATES.find(c => colNamesLower.includes(c))
    || colNames.find(n => /name|标题|名称/i.test(n));

  // 3. 组装查询 SQL
  const whereClauses = [];
  const params = {};
  for (const [k, v] of Object.entries(filter)) {
    if (!colNames.find(c => c.toLowerCase() === k.toLowerCase())) continue;
    const paramName = `f_${k}`;
    whereClauses.push(`${k} = @${paramName}`);
    params[paramName] = { type: db.sql.NVarChar, value: String(v) };
  }

  const selectCols = nameCol
    ? ['id', nameCol, ...colNames.filter(c => !['id', nameCol].includes(c)).slice(0, 10)]
    : ['*'];
  const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';
  const sql = `SELECT TOP ${parseInt(limit) || 100} ${selectCols.join(', ')}
               FROM ${tableName}
               ${whereSql}
               ORDER BY id DESC`;

  const rows = await db.query(sql, params);
  return {
    source: { tableName, nameColumn: nameCol, filterApplied: filter },
    items: rows.map(r => ({
      value: String(r.id),
      name: nameCol ? (r[nameCol] || String(r.id)) : String(r.id),
      raw: r,
    })),
  };
}

/** 只探测不查数据，返回列结构（给 AI 看用的） */
async function describe(browserName, tableHint = null) {
  const tableName = tableHint || `uf_${browserName}`;
  const exists = await schema.tableExists(tableName);
  if (!exists) return { tableName, exists: false };
  const cols = await schema.getTableColumns(tableName);
  return {
    tableName, exists: true,
    columns: cols.map(c => ({ name: c.COLUMN_NAME, type: c.DATA_TYPE })),
  };
}

module.exports = { probeAndList, describe };
