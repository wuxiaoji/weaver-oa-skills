/**
 * config.js — 配置中心
 * 只读取环境变量，不含任何业务逻辑（业务规则在 rules/ 里）
 */
require('dotenv').config();

function parseJsonEnv(name, fallback) {
  const value = process.env[name];
  if (!value) return fallback;
  try { return JSON.parse(value); } catch { return fallback; }
}

function parseListEnv(name, fallback) {
  const value = process.env[name];
  if (!value) return fallback;
  return value.split(',').map(s => s.trim()).filter(Boolean);
}

module.exports = {
  db: {
    server: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '1433'),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    options: { encrypt: false, trustServerCertificate: true },
  },

  oa: {
    baseUrl: process.env.OA_BASE_URL,
    appid: process.env.OA_APPID,
    spk: process.env.OA_SPK,
    secret: process.env.OA_SECRET,

    fileApi: {
      enabled: process.env.OA_FILE_API_ENABLED === 'true',
      uploadPath: process.env.OA_FILE_UPLOAD_PATH || '/api/doc/upload/uploadFile2Doc',
      deletePath: process.env.OA_FILE_DELETE_PATH || '/api/doc/operate/delete',
      fileFieldName: process.env.OA_FILE_UPLOAD_FIELD || 'file',
      deleteRefField: process.env.OA_FILE_DELETE_REF_FIELD || 'docid',
      category: process.env.OA_FILE_UPLOAD_CATEGORY || '',
      urlFieldCandidates: parseListEnv('OA_FILE_URL_FIELDS',
        ['loadlink', 'filelink', 'url', 'fileUrl', 'link', 'downloadUrl', 'path']),
      idFieldCandidates: parseListEnv('OA_FILE_ID_FIELDS',
        ['fileid', 'imagefileid', 'fileId', 'id', 'fid', 'docid']),
      extraUploadFields: parseJsonEnv('OA_FILE_UPLOAD_EXTRA_FIELDS', {}),
      extraDeleteParams: parseJsonEnv('OA_FILE_DELETE_EXTRA_FIELDS', {}),
    },
  },
};
