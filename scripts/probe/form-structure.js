/**
 * probe/form-structure.js — 表单结构探测
 *
 * 输入：workflowId
 * 输出：{ mainFields, detailTables: [{tableName, fields}] }
 *
 * 每个 field 包含：
 *   - field_id, field_name, label
 *   - html_type: '1'~'9'
 *   - sub_type: 子类型（文本/整数/浏览按钮的具体类型等）
 *   - db_type: 数据库字段类型或 browser.xxx
 *   - mandatory: boolean 是否必填
 *   - readonly:  boolean 只读
 *   - hidden:    boolean 隐藏
 *   - skip:      boolean 是否应跳过（AI 不必填）
 */
const db = require('../core/db');

async function getFormStructure(workflowId) {
  // 用户已确认的 SQL：关联创建节点 isstart='1' 的字段属性
  const rows = await db.query(`
    SELECT
      f.id            AS field_id,
      f.fieldname     AS field_name,
      h.labelname     AS label,
      f.fieldhtmltype AS html_type,
      f.type          AS sub_type,
      f.fielddbtype   AS db_type,
      f.dsporder      AS sort_order,
      ISNULL(NULLIF(f.detailtable, ''), 'main') AS table_name,
      CASE WHEN nf.ismandatory = '1' THEN 1 ELSE 0 END AS is_mandatory,
      CASE WHEN nf.isview = '1' AND nf.isedit = '0' THEN 1 ELSE 0 END AS is_readonly,
      CASE WHEN nf.isview = '0' THEN 1 ELSE 0 END AS is_hidden,
      CASE
        WHEN f.fieldhtmltype = '3' THEN ISNULL(bh.labelname, CAST(f.type AS varchar))
        ELSE NULL
      END AS browser_type_label
    FROM workflow_billfield f
    LEFT JOIN htmllabelinfo h
      ON f.fieldlabel = h.indexid AND h.languageid = 7
    LEFT JOIN workflow_browserurl wb
      ON f.fieldhtmltype = '3' AND f.type = wb.id
    LEFT JOIN htmllabelinfo bh
      ON wb.labelid = bh.indexid AND bh.languageid = 7
    LEFT JOIN workflow_nodeform nf
      ON nf.fieldid = f.id
      AND nf.nodeid IN (
        SELECT nb.id FROM workflow_nodebase nb
        INNER JOIN workflow_flownode fn ON fn.nodeid = nb.id
        WHERE fn.workflowid = @wf AND nb.isstart = '1'
      )
    WHERE f.billid = (SELECT formid FROM workflow_base WHERE id = @wf)
    ORDER BY f.detailtable, f.dsporder
  `, { wf: { type: db.sql.Int, value: workflowId } });

  const main = [];
  const detailMap = new Map(); // tableName -> field[]

  for (const r of rows) {
    const htmlType = String(r.html_type);
    const subType = r.sub_type;
    const label = r.label || '';

    const field = {
      field_id: r.field_id,
      field_name: r.field_name,
      label,
      html_type: htmlType,
      sub_type: subType,
      db_type: r.db_type || '',
      browser_type: r.browser_type_label || '',
      sort_order: r.sort_order,
      mandatory: r.is_mandatory === 1,
      readonly: r.is_readonly === 1,
      hidden: r.is_hidden === 1,
      skip: _shouldSkip({ htmlType, subType, label, hidden: r.is_hidden === 1 }),
      likely_system: _isLikelySystemField({ htmlType, subType, label }),
    };

    if (r.table_name === 'main') {
      main.push(field);
    } else {
      const arr = detailMap.get(r.table_name) || [];
      arr.push(field);
      detailMap.set(r.table_name, arr);
    }
  }

  const detailTables = [...detailMap.entries()].map(([tableName, fields]) => ({
    tableName,
    fields,
  }));

  return { mainFields: main, detailTables };
}

/**
 * 字段跳过规则
 *
 * 只有 label 明确标记"废弃"/"作废"的字段才跳过。
 * 其他所有字段（包括隐藏字段、文本字段等）都保留，由 AI 根据属性和规则文档决定是否传值。
 */
function _shouldSkip({ htmlType, subType, label, hidden }) {
  if (label && /废弃|作废/.test(label)) return true;
  return false;
}

/**
 * 判断字段是否"可能是系统回填"（给 AI 参考，不强制跳过）
 */
function _isLikelySystemField({ htmlType, subType, label }) {
  if (htmlType === '1' && String(subType) === '1') return true;
  return false;
}

module.exports = { getFormStructure };
