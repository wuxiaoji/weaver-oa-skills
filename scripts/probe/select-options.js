/**
 * probe/select-options.js — html_type=5 下拉框的选项
 */
const db = require('../core/db');

async function getSelectOptions(fields) {
  const result = {};
  const targets = fields.filter(f => f.html_type === '5' && !f.skip);

  for (const f of targets) {
    try {
      const rows = await db.query(
        `SELECT selectvalue, selectname FROM workflow_selectitem
         WHERE fieldid=@id ORDER BY selectvalue`,
        { id: { type: db.sql.Int, value: f.field_id } },
      );
      result[f.field_name] = {
        label: f.label,
        field_id: f.field_id,
        items: rows.map(r => ({
          value: String(r.selectvalue),
          name: r.selectname,
        })),
      };
    } catch (e) {
      result[f.field_name] = {
        label: f.label, field_id: f.field_id,
        items: [], error: e.message,
      };
    }
  }
  return result;
}

module.exports = { getSelectOptions };
