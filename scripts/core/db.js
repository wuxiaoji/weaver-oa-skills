/**
 * db.js — SQL Server 连接
 */
const sql = require('mssql');
const config = require('./config');

let pool = null;

async function getPool() {
  if (!pool) pool = await sql.connect(config.db);
  return pool;
}

async function query(str, params = {}) {
  const req = (await getPool()).request();
  for (const [k, { type, value }] of Object.entries(params))
    req.input(k, type, value);
  return (await req.query(str)).recordset;
}

async function testConnection() {
  await (await getPool()).request().query('SELECT 1 AS ok');
  return true;
}

async function close() {
  if (pool) { await pool.close(); pool = null; }
}

module.exports = { query, testConnection, close, sql };
