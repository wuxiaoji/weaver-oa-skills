/**
 * auth.js — 泛微API认证与HTTP封装
 *
 * 提供：
 *   - getToken()         Token 获取（带缓存，避免频繁申请）
 *   - callApi()          POST form-urlencoded
 *   - callGetApi()       GET
 *   - callMultipartApi() POST multipart（文件上传用）
 *   - rsaEncrypt()       RSA加密（userid 需要加密）
 */
const http = require('http');
const https = require('https');
const forge = require('node-forge');
const config = require('./config');

// ========== HTTP 底层 ==========

function _request(method, path, headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, config.oa.baseUrl);
    const lib = url.protocol === 'https:' ? https : http;
    const req = lib.request({
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        ...headers,
      },
    }, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const data = Buffer.concat(chunks).toString('utf-8');
        try { resolve(JSON.parse(data)); } catch { resolve(data); }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

// ========== RSA 加密 ==========

function rsaEncrypt(text, pubKeyBase64) {
  let pem = pubKeyBase64 || config.oa.spk;
  if (!pem.includes('BEGIN PUBLIC KEY')) {
    pem = `-----BEGIN PUBLIC KEY-----\n${pem}\n-----END PUBLIC KEY-----`;
  }
  const key = forge.pki.publicKeyFromPem(pem);
  return forge.util.encode64(key.encrypt(String(text), 'RSAES-PKCS1-V1_5'));
}

// ========== Token（带缓存）==========

let _tokenCache = { token: null, expireAt: 0 };
const TOKEN_TTL_MS = 30 * 60 * 1000; // 保守30分钟

async function getToken() {
  if (_tokenCache.token && Date.now() < _tokenCache.expireAt) {
    return _tokenCache.token;
  }
  const enc = rsaEncrypt(config.oa.secret);
  const res = await _request('POST', '/api/ec/dev/auth/applytoken', {
    appid: config.oa.appid,
    secret: enc,
    time: String(Date.now()),
  });
  if (res?.status === true || res?.status === 'true') {
    _tokenCache = { token: res.token, expireAt: Date.now() + TOKEN_TTL_MS };
    return res.token;
  }
  throw new Error('token_failed: ' + JSON.stringify(res));
}

function clearTokenCache() {
  _tokenCache = { token: null, expireAt: 0 };
}

// ========== 业务API调用 ==========

function _buildHeaders(userId, token, extra = {}) {
  return {
    appid: config.oa.appid,
    token,
    userid: rsaEncrypt(String(userId)),
    ...extra,
  };
}

function _encodeParams(params) {
  return Object.entries(params || {})
    .filter(([, v]) => v != null)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(
      typeof v === 'object' ? JSON.stringify(v) : v,
    )}`)
    .join('&');
}

async function callApi(path, params, userId, token) {
  const headers = _buildHeaders(userId, token);
  return _request('POST', path, headers, _encodeParams(params));
}

async function callGetApi(path, params, userId, token) {
  const headers = _buildHeaders(userId, token);
  const query = _encodeParams(params);
  const fullPath = query ? `${path}${path.includes('?') ? '&' : '?'}${query}` : path;
  return _request('GET', fullPath, headers);
}

async function callMultipartApi(path, fields, files, userId, token) {
  const boundary = `----weaver-skill-${Date.now().toString(16)}`;
  const chunks = [];

  for (const [k, v] of Object.entries(fields || {})) {
    chunks.push(Buffer.from(
      `--${boundary}\r\n`
      + `Content-Disposition: form-data; name="${k}"\r\n\r\n`
      + `${v == null ? '' : String(v)}\r\n`,
    ));
  }
  for (const file of files || []) {
    chunks.push(Buffer.from(
      `--${boundary}\r\n`
      + `Content-Disposition: form-data; name="${file.fieldName}"; filename="${file.fileName}"\r\n`
      + `Content-Type: ${file.contentType || 'application/octet-stream'}\r\n\r\n`,
    ));
    chunks.push(file.data);
    chunks.push(Buffer.from('\r\n'));
  }
  chunks.push(Buffer.from(`--${boundary}--\r\n`));

  const body = Buffer.concat(chunks);
  const headers = _buildHeaders(userId, token, {
    'Content-Type': `multipart/form-data; boundary=${boundary}`,
    'Content-Length': String(body.length),
  });
  return _request('POST', path, headers, body);
}

module.exports = {
  getToken, clearTokenCache,
  callApi, callGetApi, callMultipartApi,
  rsaEncrypt,
};
