/**
 * data-source/common.js — 通用人事字典（语言、学历、职称、办公地点等）
 *
 * 泛微 HrmSystemField 存放各类系统字典，但不同版本表名可能不同。
 * 这里用多候选表名探测，找不到就返回空+提示。
 */
const db = require('../core/db');
const schema = require('../probe/schema');

async function _tryList(tableCandidates, mapper) {
  for (const t of tableCandidates) {
    if (await schema.tableExists(t)) {
      try {
        const rows = await db.query(`SELECT TOP 500 * FROM ${t} ORDER BY id`);
        return rows.map(mapper);
      } catch { /* 继续 */ }
    }
  }
  return [];
}

/** 语言 */
async function listLanguages() {
  return _tryList(
    ['HrmLanguage', 'HrmLanguages'],
    r => ({ value: String(r.id), name: r.languagename || r.name, raw: r }),
  );
}

/** 学历 */
async function listEducation() {
  return _tryList(
    ['HrmEducationLevel', 'HrmEducation'],
    r => ({ value: String(r.id), name: r.educationname || r.name, raw: r }),
  );
}

/** 职称 */
async function listTechTitles() {
  return _tryList(
    ['HrmTechTitle', 'HrmTechnicalTitle'],
    r => ({ value: String(r.id), name: r.techtitlename || r.name, raw: r }),
  );
}

/** 办公地点 */
async function listLocations() {
  return _tryList(
    ['HrmLocations', 'hrmlocations'],
    r => ({ value: String(r.id), name: r.locationname, raw: r }),
  );
}

/** 用工性质 / 其他通用分类字段 */
async function listByCategory(categoryKey) {
  // 尝试通用表 HrmSystemField / HrmStateLabel
  const candidates = ['HrmSystemField', 'HrmStateLabel', 'HrmMyField'];
  for (const t of candidates) {
    if (await schema.tableExists(t)) {
      try {
        const cols = await schema.getTableColumns(t);
        const colNames = cols.map(c => c.COLUMN_NAME.toLowerCase());
        if (colNames.includes('fieldname')) {
          const rows = await db.query(
            `SELECT TOP 200 * FROM ${t} WHERE fieldname = @k`,
            { k: { type: db.sql.NVarChar, value: categoryKey } },
          );
          if (rows.length) {
            return rows.map(r => ({
              value: String(r.id || r.fieldvalue),
              name: r.fieldlabel || r.labelname || r.name || String(r.id),
              raw: r,
            }));
          }
        }
      } catch { /* 继续 */ }
    }
  }
  return [];
}

module.exports = {
  listLanguages, listEducation, listTechTitles,
  listLocations, listByCategory,
};
