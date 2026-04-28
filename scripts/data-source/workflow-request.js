/**
 * data-source/workflow-request.js — 关联流程查询
 *
 * 用于"多流程"类型的浏览按钮字段（如关联出差申请）。
 */
const db = require('../core/db');

/**
 * 按名称关键词查找流程定义
 */
async function findWorkflowsByKeyword(keyword) {
  const rows = await db.query(`
    SELECT id, workflowname
    FROM workflow_base
    WHERE workflowname LIKE @kw
    ORDER BY id
  `, { kw: { type: db.sql.NVarChar, value: `%${keyword}%` } });
  return rows;
}

/**
 * 查某人近 N 天已归档的流程（currentnodetype=3 代表已归档）
 */
async function getArchivedRequests({ workflowIds, personId, days = 30 }) {
  if (!workflowIds || !workflowIds.length) return [];

  const ph = workflowIds.map((_, i) => `@w${i}`).join(',');
  const params = {
    pid: { type: db.sql.Int, value: parseInt(personId) },
    since: { type: db.sql.VarChar, value: _daysAgo(days) },
  };
  workflowIds.forEach((id, i) => {
    params[`w${i}`] = { type: db.sql.Int, value: parseInt(id) };
  });

  const rows = await db.query(`
    SELECT
      r.requestid    AS request_id,
      r.requestname  AS request_title,
      r.createdate   AS create_date,
      r.workflowid   AS workflow_id,
      wb.workflowname AS workflow_name,
      h.lastname     AS creator_name
    FROM workflow_requestbase r
    LEFT JOIN HrmResource h ON r.creater = h.id
    LEFT JOIN workflow_base wb ON r.workflowid = wb.id
    WHERE r.workflowid IN (${ph})
      AND r.creater = @pid
      AND r.currentnodetype = 3
      AND r.createdate >= @since
    ORDER BY r.createdate DESC
  `, params);

  return rows.map(r => ({
    value: String(r.request_id),
    name: `[${r.request_id}] ${r.request_title} (${r.workflow_name}, ${r.create_date})`,
    raw: r,
  }));
}

/** 一步到位：按关键词查流程定义，再按人查近 N 天归档 */
async function searchByKeyword({ keyword, personId, days = 30 }) {
  const wfs = await findWorkflowsByKeyword(keyword);
  if (!wfs.length) {
    return { workflows: [], requests: [] };
  }
  const requests = await getArchivedRequests({
    workflowIds: wfs.map(w => w.id),
    personId, days,
  });
  return { workflows: wfs, requests };
}

function _daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

module.exports = {
  findWorkflowsByKeyword,
  getArchivedRequests,
  searchByKeyword,
};
