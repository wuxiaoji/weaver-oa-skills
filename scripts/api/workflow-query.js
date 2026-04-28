/**
 * api/workflow-query.js — 流程查询
 *
 * getWorkflowRequest:  /api/workflow/paService/getWorkflowRequest
 * getRequestStatus:    /api/workflow/paService/getRequestStatus
 */
const auth = require('../core/auth');

async function getWorkflowRequest({ workflowId, requestId, userId }) {
  const token = await auth.getToken();
  return auth.callGetApi(
    '/api/workflow/paService/getWorkflowRequest',
    { workflowId, workflowIdList: requestId },
    userId, token,
  );
}

async function getRequestStatus({ requestId, userId }) {
  const token = await auth.getToken();
  return auth.callGetApi(
    '/api/workflow/paService/getRequestStatus',
    { requestId },
    userId, token,
  );
}

module.exports = { getWorkflowRequest, getRequestStatus };
