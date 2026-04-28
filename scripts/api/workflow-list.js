/**
 * api/workflow-list.js — 获取用户可创建的流程列表
 *
 * 泛微接口：POST /api/workflow/paService/getCreateWorkflowList
 * 请求方式：x-www-form-urlencoded
 * 返回格式（实测）：
 *   {
 *     code: "SUCCESS",
 *     data: [
 *       { workflowId, workflowName, workflowTypeId, workflowTypeName, ... }
 *     ]
 *   }
 * 或：
 *   { status: "1", datas: [ { ... } ] }
 *
 * 两种格式都兼容。
 */
const auth = require('../core/auth');

async function getCreateWorkflowList({ userId, typeId, keyword }) {
  const token = await auth.getToken();
  const params = {};
  if (typeId) params.typeId = typeId;
  if (keyword) params.keyword = keyword;

  const res = await auth.callApi(
    '/api/workflow/paService/getCreateWorkflowList',
    params,
    userId,
    token,
  );

  // 归一化返回
  const list = _extractList(res);
  return {
    raw: res,
    workflows: list.map(_normalizeItem),
  };
}

function _extractList(res) {
  if (Array.isArray(res)) return res;
  if (Array.isArray(res?.data)) return res.data;
  if (Array.isArray(res?.datas)) return res.datas;
  if (Array.isArray(res?.data?.list)) return res.data.list;
  if (Array.isArray(res?.data?.workflowList)) return res.data.workflowList;
  return [];
}

function _normalizeItem(item) {
  return {
    workflow_id: item.workflowId || item.workflowid || item.id,
    workflow_name: item.workflowName || item.workflowname || item.name,
    workflow_type_id: item.workflowTypeId || item.workflowtypeid,
    workflow_type_name: item.workflowTypeName || item.workflowtypename,
    form_id: item.formId || item.formid,
    is_bill: item.isBill || item.isbill,
    raw: item,
  };
}

module.exports = { getCreateWorkflowList };
