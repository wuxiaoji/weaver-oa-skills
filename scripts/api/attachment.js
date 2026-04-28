/**
 * api/attachment.js — 附件上传与清理
 *
 * 从旧 core.js 中抽取的附件处理逻辑，改为通用模块。
 *
 * 三种 filePath 来源：
 *   1. URL (https://...) → 不上传，直接使用
 *   2. OA路径 (/weaver/ecology/filesystem/...) → 不上传，直接使用
 *   3. 本地文件路径 / base64 → 调用 uploadFile2Doc 上传，拿到 docid 和 URL
 *
 * 附件字段最终值格式：docid,docid,docid（逗号分隔字符串）
 */
const fs = require('fs');
const path = require('path');
const auth = require('../core/auth');
const config = require('../core/config');

// ========== 公开 API ==========

/**
 * 批量准备附件
 * @param {Array} files [{filePath, fileName}, ...]
 * @param {number} userId
 * @param {string} token
 * @param {Array} uploadedTracker 可选，收集已上传文件以便失败时清理
 * @returns {Array} 处理后的文件列表（含 id/url）
 */
async function prepareAttachments(files, userId, token, uploadedTracker = []) {
  if (!files || !files.length) return null;
  const prepared = [];
  for (const file of files) {
    prepared.push(await prepareOne(file, userId, token, uploadedTracker));
  }
  return prepared;
}

/**
 * 单个附件处理
 */
async function prepareOne(file, userId, token, uploadedTracker = []) {
  if (!file?.filePath) return file;
  if (!_shouldUpload(file.filePath)) return file;

  const uploadCfg = config.oa.fileApi;
  if (!uploadCfg.enabled) return file;

  const source = _readSource(file);
  const response = await auth.callMultipartApi(
    uploadCfg.uploadPath,
    {
      ...uploadCfg.extraUploadFields,
      category: uploadCfg.extraUploadFields?.category || uploadCfg.category,
      name: file.fileName || source.fileName,
    },
    [{
      fieldName: uploadCfg.fileFieldName,
      fileName: file.fileName || source.fileName,
      data: source.data,
      contentType: source.contentType,
    }],
    userId, token,
  );

  const uploaded = _normalizeResponse(response, file.fileName || source.fileName);
  uploadedTracker.push(uploaded);
  return {
    filePath: uploaded.url,
    fileName: file.fileName || source.fileName,
    id: uploaded.id,
  };
}

/**
 * 将附件数组转为泛微字段值格式：docid,docid,...
 */
function toFieldValue(files) {
  if (!files || !files.length) return '';
  return files
    .map(f => f.id || f.filePath)
    .filter(Boolean)
    .join(',');
}

/**
 * 清理已上传的附件（提交失败时调用）
 */
async function cleanupUploaded(uploadedFiles, userId, token) {
  if (!uploadedFiles?.length || !config.oa.fileApi?.enabled) return { deleted: [], errors: [] };
  const result = { deleted: [], errors: [] };

  for (const file of uploadedFiles) {
    try {
      const ref = file.id || file.url;
      if (!ref) continue;
      const cfg = config.oa.fileApi;
      const res = await auth.callGetApi(
        cfg.deletePath,
        { ...cfg.extraDeleteParams, [cfg.deleteRefField]: ref },
        userId, token,
      );
      const ok = res?.status === 1 || res?.status === '1'
        || res?.status === true || res?.code === 'SUCCESS';
      if (ok) result.deleted.push(ref);
      else result.errors.push({ ref, response: res });
    } catch (e) {
      result.errors.push({ ref: file.id || '', error: e.message });
    }
  }
  return result;
}

// ========== 内部工具 ==========

function _shouldUpload(filePath) {
  if (!filePath) return false;
  if (/^https?:\/\//i.test(filePath)) return false;
  if (/^\/weaver\/ecology\/filesystem\//i.test(filePath)) return false;
  return true;
}

function _readSource(file) {
  const raw = String(file.filePath || '').trim();

  // 本地文件
  if (fs.existsSync(raw)) {
    return {
      data: fs.readFileSync(raw),
      fileName: file.fileName || path.basename(raw),
      contentType: _contentType(file.fileName || raw),
    };
  }

  // base64 (含 data:... 前缀 或 纯 base64)
  const base64 = raw.startsWith('data:')
    ? raw.slice(raw.indexOf(',') + 1)
    : raw;
  if (!/^[A-Za-z0-9+/=\r\n]+$/.test(base64)) {
    throw new Error(`attachment_source_not_supported: ${file.fileName || raw.slice(0, 50)}`);
  }
  return {
    data: Buffer.from(base64.replace(/\s+/g, ''), 'base64'),
    fileName: file.fileName || 'attachment.bin',
    contentType: _contentType(file.fileName || ''),
  };
}

function _normalizeResponse(response, fileName) {
  const url = _pickNested(response, config.oa.fileApi.urlFieldCandidates);
  const id = _pickNested(response, config.oa.fileApi.idFieldCandidates);
  if (!url && !id) {
    throw new Error(`upload_missing_url_or_id: ${JSON.stringify(response)}`);
  }
  let normalizedUrl = url ? String(url) : '';
  if (normalizedUrl && normalizedUrl.startsWith('/')) {
    try { normalizedUrl = new URL(normalizedUrl, config.oa.baseUrl).toString(); } catch {}
  }
  return { fileName, url: normalizedUrl, id: id ? String(id) : null, raw: response };
}

function _pickNested(obj, candidates) {
  const queue = [obj];
  while (queue.length) {
    const cur = queue.shift();
    if (!cur || typeof cur !== 'object') continue;
    for (const key of candidates) {
      if (cur[key] != null) return cur[key];
    }
    for (const v of Object.values(cur)) {
      if (v && typeof v === 'object') queue.push(v);
    }
  }
  return null;
}

function _contentType(fileName) {
  const ext = path.extname(fileName || '').toLowerCase();
  const map = {
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
    '.gif': 'image/gif', '.webp': 'image/webp', '.bmp': 'image/bmp',
    '.pdf': 'application/pdf',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.txt': 'text/plain', '.zip': 'application/zip', '.rar': 'application/vnd.rar',
  };
  return map[ext] || 'application/octet-stream';
}

module.exports = { prepareAttachments, prepareOne, toFieldValue, cleanupUploaded };
