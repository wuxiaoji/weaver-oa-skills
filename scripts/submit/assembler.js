/**
 * submit/assembler.js — 纯结构映射
 *
 * 职责：把 AI 组装好的 { fieldName: value } 键值对转为泛微 API 需要的格式。
 * 不做任何业务判断（超标、NCC、职级等由 AI + 规则文档处理）。
 *
 * AI 传什么就组装什么，这里只管格式转换。
 */
const attachment = require('../api/attachment');

/**
 * 组装主表数据
 *
 * @param {Object} values  { fieldName: fieldValue, ... }
 *                          附件字段的值是 [{filePath, fileName, id?}] 数组
 * @param {Array}  fields  form-structure 返回的 mainFields（用于识别附件字段）
 * @returns {Array} [ {fieldName, fieldValue}, ... ] 泛微 API 格式
 */
function assembleMainData(values, fields) {
  const result = [];
  for (const [fieldName, rawValue] of Object.entries(values || {})) {
    if (rawValue == null) continue;
    const field = fields.find(f => f.field_name === fieldName);
    const isAtt = field && field.html_type === '6';

    let fieldValue;
    if (isAtt && Array.isArray(rawValue)) {
      fieldValue = attachment.toFieldValue(rawValue);
    } else {
      fieldValue = String(rawValue);
    }

    if (fieldValue === '' && !isAtt) continue; // 空值不传（附件空串也跳过）
    if (isAtt && !fieldValue) continue;

    result.push({ fieldName, fieldValue });
  }
  return result;
}

/**
 * 组装明细表数据（支持多明细表）
 *
 * @param {Object} detailValues {
 *   "formtable_main_214_dt1": [
 *     { fylx1: "15", fyje: "1200", ... },   // 第1行
 *     { fylx1: "16", fyje: "960", ... },     // 第2行
 *   ],
 *   "formtable_main_15_dt2": [
 *     { mx01: "父亲", mx02: "张三", ... },
 *   ]
 * }
 * @param {Array} detailTables form-structure 返回的 detailTables
 * @returns {Array} 泛微 API detailData 格式
 */
function assembleDetailData(detailValues, detailTables) {
  const result = [];

  for (const dt of detailTables) {
    const rows = detailValues[dt.tableName];
    if (!rows || !rows.length) continue;

    const records = rows.map((rowValues, i) => {
      const fields = [];
      for (const [fieldName, rawValue] of Object.entries(rowValues || {})) {
        if (rawValue == null) continue;
        const field = dt.fields.find(f => f.field_name === fieldName);
        const isAtt = field && field.html_type === '6';

        let fieldValue;
        if (isAtt && Array.isArray(rawValue)) {
          fieldValue = attachment.toFieldValue(rawValue);
        } else {
          fieldValue = String(rawValue);
        }

        if (!fieldValue && !isAtt) continue;
        if (isAtt && !fieldValue) continue;

        fields.push({ fieldName, fieldValue });
      }
      return { recordOrder: i, workflowRequestTableFields: fields };
    });

    result.push({
      tableDBName: dt.tableName,
      workflowRequestTableRecords: records,
    });
  }

  return result;
}

module.exports = { assembleMainData, assembleDetailData };
