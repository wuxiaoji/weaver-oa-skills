/**
 * probe/browser-options.js — html_type=3 浏览按钮的选项
 *
 * 按 fielddbtype 和 browser_type 分派到不同的数据源查询器。
 * 分派不了的（如陌生的 browser.xxx）返回 needConfig 提示，让 AI 去读规则文档或问用户。
 */
const hrm = require('../data-source/hrm');
const common = require('../data-source/common');
const doc = require('../data-source/document');
const wfReq = require('../data-source/workflow-request');
const customBrowser = require('../data-source/custom-browser');

/**
 * 对所有浏览按钮字段批量查询选项
 * @param {Array} fields 字段列表
 * @param {Object} ctx 上下文 { user?, ruleHints? }  ← 规则文档可提供额外提示
 */
async function getBrowserOptions(fields, ctx = {}) {
  const result = {};
  const targets = fields.filter(f => f.html_type === '3' && !f.skip);

  for (const f of targets) {
    try {
      result[f.field_name] = await _resolveOne(f, ctx);
    } catch (e) {
      result[f.field_name] = {
        label: f.label, field_id: f.field_id,
        items: [], error: e.message,
        needConfig: true,
      };
    }
  }
  return result;
}

/**
 * 按 browser_type / db_type 分派
 * 返回值统一格式: { label, field_id, type, items: [{value, name, raw?}], needConfig?, hint? }
 */
async function _resolveOne(f, ctx) {
  const L = f.label || '';
  const bt = f.browser_type || '';    // 泛微类型标签（人力资源/部门/岗位/日期等）
  const dbType = String(f.db_type || '').toLowerCase();

  // ---- 日期/时间类 ----
  if (bt.includes('日期') || bt.includes('时间')) {
    return {
      label: L, field_id: f.field_id, type: 'date_or_time',
      items: [],
      hint: '日期/时间字段，让用户直接输入（YYYY-MM-DD 或 HH:mm），不需要查选项',
    };
  }

  // ---- 模板类（文档模板）→ 自动跳过 ----
  if (L.includes('模板')) {
    return {
      label: L, field_id: f.field_id, type: 'template',
      items: [],
      hint: '模板字段通常由流程配置自动带出，可尝试不传',
    };
  }

  // ---- 人力资源 ----
  if (bt.includes('人力资源') || bt.includes('人员')) {
    // 申请人/制单人由用户信息自动回填，不必查选项
    if (/申请人|制单人/.test(L)) {
      return {
        label: L, field_id: f.field_id, type: 'hrm_auto',
        items: [],
        hint: '申请人/制单人：使用 user.person_id 自动填充',
      };
    }
    // 直接上级/助理/介绍人 → 需要用户提供姓名+工号，再调 user 命令查
    return {
      label: L, field_id: f.field_id, type: 'hrm',
      items: [],
      hint: `人员浏览按钮。让用户提供姓名+工号，调用 'node index.js user <n> <workCode>' 查 person_id`,
    };
  }

  // ---- 部门 ----
  if (bt.includes('部门')) {
    if (/申请部门|入职部门/.test(L)) {
      return {
        label: L, field_id: f.field_id, type: 'dept_auto',
        items: [],
        hint: '申请部门：使用 user.dept_id 自动填充',
      };
    }
    const items = await hrm.listDepartments({ limit: ctx.limit || 200 });
    return { label: L, field_id: f.field_id, type: 'dept', items };
  }

  // ---- 分部 ----
  if (bt.includes('分部')) {
    const items = await hrm.listSubCompanies();
    return { label: L, field_id: f.field_id, type: 'subcompany', items };
  }

  // ---- 岗位 ----
  if (bt.includes('岗位')) {
    if (/申请人职位|岗位/.test(L) && /申请|本人/.test(L) === false) {
      // 无明确"本人"字样时，可能是需要用户选岗位
      const items = await hrm.listJobTitles();
      return { label: L, field_id: f.field_id, type: 'jobtitle', items };
    }
    return {
      label: L, field_id: f.field_id, type: 'jobtitle_auto',
      items: [],
      hint: '申请人岗位：使用 user.job_title_id 自动填充（int浏览框，传ID，OA自动显示名称）',
    };
  }

  // ---- 语言 ----
  if (bt.includes('语言')) {
    const items = await common.listLanguages();
    return { label: L, field_id: f.field_id, type: 'language', items };
  }

  // ---- 学历 ----
  if (bt.includes('学历')) {
    const items = await common.listEducation();
    return { label: L, field_id: f.field_id, type: 'education', items };
  }

  // ---- 职称 ----
  if (bt.includes('职称')) {
    const items = await common.listTechTitles();
    return { label: L, field_id: f.field_id, type: 'techtitle', items };
  }

  // ---- 用工性质 / 办公地点 / 民族 等通用人事字典 ----
  if (bt.includes('用工性质')) {
    const items = await common.listByCategory('usekind');
    return { label: L, field_id: f.field_id, type: 'usekind', items };
  }
  if (bt.includes('办公地点')) {
    const items = await common.listLocations();
    return { label: L, field_id: f.field_id, type: 'location', items };
  }

  // ---- 文档 ----
  if (bt.includes('文档')) {
    return {
      label: L, field_id: f.field_id, type: 'document',
      items: [],
      hint: '文档浏览按钮，让用户直接提供 docid 或上传附件获取',
    };
  }

  // ---- 多流程 / 相关流程 ----
  if (bt.includes('多流程') || bt.includes('流程')) {
    return {
      label: L, field_id: f.field_id, type: 'workflow_request',
      items: [],
      hint: `多流程字段。用 'node index.js related-requests --keyword <关键词> --user <userId> --days <n>' 查关联流程`,
    };
  }

  // ---- 自定义浏览按钮 browser.xxx ----
  if (dbType.startsWith('browser.')) {
    const browserName = dbType.replace('browser.', '');
    // 先尝试通用查询 uf_<browserName>
    const probed = await customBrowser.probeAndList(browserName, { filter: ctx.filters?.[f.field_name] });
    if (probed.items && probed.items.length > 0) {
      return {
        label: L, field_id: f.field_id, type: `custom_browser:${browserName}`,
        items: probed.items,
        source: probed.source,
      };
    }
    return {
      label: L, field_id: f.field_id, type: `custom_browser:${browserName}`,
      items: [],
      needConfig: true,
      hint: `自定义浏览按钮 ${dbType}。通用查询未命中，请在规则文档中声明 dataSource，或使用 'node index.js custom-browser ${browserName}' 手动查询`,
    };
  }

  // ---- 兜底 ----
  return {
    label: L, field_id: f.field_id, type: 'unknown',
    items: [],
    needConfig: true,
    hint: `未识别的浏览按钮类型：browser_type='${bt}', db_type='${f.db_type}'。请在规则文档中补充说明`,
  };
}

module.exports = { getBrowserOptions };
