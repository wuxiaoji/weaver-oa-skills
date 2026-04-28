/**
 * data-source/hrm.js — 组织架构数据源
 */
const db = require('../core/db');

/**
 * 按姓名+工号精确查申请人信息
 * 返回: { person_id, work_code, person_name, dept_id, dept_name,
 *         job_title_id, job_title_name, job_level, email, location }
 */
async function getUserByNameAndCode(name, workCode) {
  const rows = await db.query(`
    SELECT
      h.id                  AS person_id,
      h.loginid             AS work_code,
      h.lastname            AS person_name,
      dep.id                AS dept_id,
      dep.departmentname    AS dept_name,
      jt.id                 AS job_title_id,
      jt.jobtitlename       AS job_title_name,
      cf.field731           AS job_level,
      h.email               AS email,
      hl.locationname       AS location,
      h.mobile              AS phone_number
    FROM HrmResource h
    LEFT JOIN HrmDepartment dep ON h.departmentid = dep.id
    LEFT JOIN HrmJobTitles jt ON h.jobtitle = jt.id
    LEFT JOIN cus_fielddata cf ON h.id = cf.id
    LEFT JOIN hrmlocations hl ON hl.id = h.locationid
    WHERE h.status IN (0, 1)
      AND h.lastname = @n AND h.loginid = @c
    ORDER BY h.departmentid, h.id
  `, {
    n: { type: db.sql.NVarChar, value: name },
    c: { type: db.sql.NVarChar, value: workCode },
  });

  if (!rows.length) {
    throw new Error(`user_not_found: ${name}/${workCode}`);
  }
  return rows[0];
}

/** 模糊搜索人员（关键词） */
async function searchUsers(keyword, limit = 20) {
  const rows = await db.query(`
    SELECT TOP ${parseInt(limit) || 20}
      h.id AS person_id,
      h.loginid AS work_code,
      h.lastname AS person_name,
      dep.departmentname AS dept_name
    FROM HrmResource h
    LEFT JOIN HrmDepartment dep ON h.departmentid = dep.id
    WHERE h.status IN (0, 1)
      AND (h.lastname LIKE @kw OR h.loginid LIKE @kw)
    ORDER BY h.lastname
  `, { kw: { type: db.sql.NVarChar, value: `%${keyword}%` } });

  return rows.map(r => ({
    value: String(r.person_id),
    name: `${r.person_name} (${r.work_code}) - ${r.dept_name || ''}`,
    raw: r,
  }));
}

/** 部门列表 */
async function listDepartments({ limit = 200 } = {}) {
  const rows = await db.query(`
    SELECT TOP ${parseInt(limit) || 200}
      id, departmentname, supdepid
    FROM HrmDepartment
    WHERE canceled = 0 OR canceled IS NULL
    ORDER BY showorder, id
  `);
  return rows.map(r => ({
    value: String(r.id),
    name: r.departmentname,
    raw: r,
  }));
}

/** 分部列表 */
async function listSubCompanies() {
  const rows = await db.query(`
    SELECT id, subcompanyname, supsubcomid
    FROM HrmSubCompany
    WHERE canceled = 0 OR canceled IS NULL
    ORDER BY showorder, id
  `);
  return rows.map(r => ({
    value: String(r.id),
    name: r.subcompanyname,
    raw: r,
  }));
}

/** 岗位列表 */
async function listJobTitles({ limit = 500 } = {}) {
  const rows = await db.query(`
    SELECT TOP ${parseInt(limit) || 500}
      id, jobtitlename
    FROM HrmJobTitles
    ORDER BY jobtitlename
  `);
  return rows.map(r => ({
    value: String(r.id),
    name: r.jobtitlename,
    raw: r,
  }));
}

module.exports = {
  getUserByNameAndCode, searchUsers,
  listDepartments, listSubCompanies, listJobTitles,
};
