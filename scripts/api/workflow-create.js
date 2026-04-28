/**
 * api/workflow-create.js — 创建流程
 *
 * 泛微接口：POST /api/workflow/paService/doCreateRequest
 *
 * isnextflow:
 *   '0' = 仅创建保存（停留在创建节点，不发起审批） ← 默认
 *   '1' = 创建并发起（自动流转到下一审批节点）   ← autoSubmit=true 时
 *
 * 为了兼容不同版本泛微API，isnextflow 同时作为顶层参数 + otherParams 内参数发送。
 */
const auth = require('../core/auth');

async function doCreateRequest({
  workflowId, mainData, detailData,
  userId, requestName, autoSubmit = false,
}) {
  const token = await auth.getToken();
  const isnextflow = autoSubmit === true ? 1 : 0;

  // 流程标题统一加 "AI创建-" 前缀
  const finalName = requestName
    ? (requestName.startsWith('AI创建') ? requestName : `AI创建-${requestName}`)
    : `AI创建-${new Date().toISOString().slice(0, 10)}`;

  const params = {
    workflowId,
    mainData: JSON.stringify(mainData || []),
    isnextflow: String(isnextflow),
    requestName: finalName,
  };
  if (detailData && detailData.length) {
    params.detailData = JSON.stringify(detailData);
  }

  params.otherParams = JSON.stringify({
    isnextflow,
    delReqFlowFaild: 1,
  });

  const res = await auth.callApi(
    '/api/workflow/paService/doCreateRequest',
    params, userId, token,
  );

  const isOk = res?.code === 'SUCCESS'
    || res?.status === true
    || res?.status === 'true'
    || res?.status === '1';
  const requestId = res?.data?.requestid
    || res?.data?.requestId
    || res?.requestid
    || res?.requestId
    || null;

  return {
    success: !!(isOk && requestId),
    requestId: requestId ? String(requestId) : null,
    mode: autoSubmit ? 'submitted' : 'draft',
    raw: res,
    debug: {
      isnextflow_sent: isnextflow,
      workflowId,
      mainFieldCount: (mainData || []).length,
      detailTableCount: (detailData || []).length,
    },
  };
}

module.exports = { doCreateRequest };
