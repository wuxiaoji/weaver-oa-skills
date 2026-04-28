/**
 * index.js — CLI 统一入口
 *
 * 所有命令输出纯 JSON，AI 可直接 JSON.parse。
 *
 * 命令列表：
 *   list-workflows --user <userId>
 *   form-info <workflowId>
 *   user <name> <workCode>
 *   select-options <workflowId>
 *   browser-options <workflowId>
 *   data-source <type> [args...]
 *   custom-browser <browserName> [--filter k=v]
 *   related-requests --keyword <kw> --user <userId> --days <n>
 *   diagnose
 *   upload-file <filePath> --user <userId>
 *   submit <input.json> [--auto-submit]
 *   test-db
 *   get-token
 */
const fs = require('fs');
const db = require('./core/db');
const auth = require('./core/auth');
const formStructure = require('./probe/form-structure');
const selectOptions = require('./probe/select-options');
const browserOptions = require('./probe/browser-options');
const schemaProbe = require('./probe/schema');
const hrm = require('./data-source/hrm');
const wfReq = require('./data-source/workflow-request');
const customBrowser = require('./data-source/custom-browser');
const wfList = require('./api/workflow-list');
const wfCreate = require('./api/workflow-create');
const attachment = require('./api/attachment');
const assembler = require('./submit/assembler');

function out(data) {
  process.stdout.write(JSON.stringify(data, null, 2) + '\n');
}

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      const key = argv[i].slice(2);
      const val = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
      args[key] = val;
    } else {
      args._.push(argv[i]);
    }
  }
  return args;
}

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const args = parseArgs(rest);

  switch (cmd) {

    // ====== 流程发现 ======
    case 'list-workflows': {
      const userId = args.user || args._[0];
      if (!userId) { out({ error: 'Usage: list-workflows --user <userId>' }); break; }
      const res = await wfList.getCreateWorkflowList({ userId });
      out(res.workflows);
      break;
    }

    // ====== 表单结构 ======
    case 'form-info': {
      const wfId = parseInt(args._[0]);
      if (!wfId) { out({ error: 'Usage: form-info <workflowId>' }); break; }
      const structure = await formStructure.getFormStructure(wfId);
      // 同时查下拉选项
      const allFields = [...structure.mainFields, ...structure.detailTables.flatMap(d => d.fields)];
      const selOpts = await selectOptions.getSelectOptions(allFields);
      out({ ...structure, selectOptions: selOpts });
      break;
    }

    // ====== 用户查询 ======
    case 'user': {
      const [name, workCode] = args._;
      if (!name || !workCode) { out({ error: 'Usage: user <name> <workCode>' }); break; }
      const user = await hrm.getUserByNameAndCode(name, workCode);
      out(user);
      break;
    }

    // ====== 下拉选项 ======
    case 'select-options': {
      const wfId = parseInt(args._[0]);
      if (!wfId) { out({ error: 'Usage: select-options <workflowId>' }); break; }
      const structure = await formStructure.getFormStructure(wfId);
      const allFields = [...structure.mainFields, ...structure.detailTables.flatMap(d => d.fields)];
      const opts = await selectOptions.getSelectOptions(allFields);
      out(opts);
      break;
    }

    // ====== 浏览按钮选项 ======
    case 'browser-options': {
      const wfId = parseInt(args._[0]);
      if (!wfId) { out({ error: 'Usage: browser-options <workflowId>' }); break; }
      const structure = await formStructure.getFormStructure(wfId);
      const allFields = [...structure.mainFields, ...structure.detailTables.flatMap(d => d.fields)];
      const opts = await browserOptions.getBrowserOptions(allFields, {});
      out(opts);
      break;
    }

    // ====== 自定义浏览按钮 ======
    case 'custom-browser': {
      const browserName = args._[0];
      if (!browserName) { out({ error: 'Usage: custom-browser <browserName> [--filter k=v]' }); break; }
      const filter = {};
      if (args.filter) {
        const parts = String(args.filter).split('=');
        if (parts.length === 2) filter[parts[0]] = parts[1];
      }
      const res = await customBrowser.probeAndList(browserName, { filter });
      out(res);
      break;
    }

    // ====== 关联流程 ======
    case 'related-requests': {
      const keyword = args.keyword || args._[0];
      const userId = args.user;
      const days = parseInt(args.days || '30');
      if (!keyword || !userId) {
        out({ error: 'Usage: related-requests --keyword <kw> --user <userId> [--days 30]' });
        break;
      }
      const res = await wfReq.searchByKeyword({ keyword, personId: userId, days });
      out(res);
      break;
    }

    // ====== 诊断 ======
    case 'diagnose': {
      const tables = [
        'workflow_selectitem', 'workflow_billfield', 'workflow_base',
        'workflow_requestbase', 'workflow_nodeform', 'workflow_nodebase',
        'workflow_flownode', 'htmllabelinfo',
        'HrmResource', 'HrmDepartment', 'HrmSubCompany', 'HrmJobTitles',
        'cus_fielddata', 'hrmlocations',
        'uf_fybzv1', 'uf_nccyfxm',
      ];
      const res = await schemaProbe.diagnose(tables);
      out(res);
      break;
    }

    // ====== 附件上传 ======
    case 'upload-file': {
      const filePath = args._[0];
      const userId = args.user;
      if (!filePath || !userId) {
        out({ error: 'Usage: upload-file <filePath> --user <userId>' });
        break;
      }
      const token = await auth.getToken();
      const result = await attachment.prepareOne(
        { filePath, fileName: require('path').basename(filePath) },
        userId, token,
      );
      out(result);
      break;
    }

    // ====== 提交流程 ======
    case 'submit': {
      const inputFile = args._[0];
      if (!inputFile) { out({ error: 'Usage: submit <input.json> [--auto-submit]' }); break; }
      const input = JSON.parse(fs.readFileSync(inputFile, 'utf-8'));

      // input 格式:
      // {
      //   workflowId: 309,
      //   userId: 399,
      //   requestName: "差旅费报销-马田-2026-03-31",
      //   mainData: { sqr: "399", sqbm: "126", ... },
      //   detailData: {
      //     "formtable_main_214_dt1": [ { fylx1: "15", fyje: "1200", ... } ]
      //   }
      // }
      const structure = await formStructure.getFormStructure(input.workflowId);
      const mainData = assembler.assembleMainData(input.mainData, structure.mainFields);
      const detailData = assembler.assembleDetailData(input.detailData || {}, structure.detailTables);

      const result = await wfCreate.doCreateRequest({
        workflowId: input.workflowId,
        mainData,
        detailData,
        userId: input.userId,
        requestName: input.requestName,
        autoSubmit: args['auto-submit'] === true || input.autoSubmit === true,
      });
      out(result);
      break;
    }

    // ====== 测试连接 ======
    case 'test-db': {
      await db.testConnection();
      out({ status: 'ok', server: require('./core/config').db.server });
      break;
    }

    // ====== Token ======
    case 'get-token': {
      const token = await auth.getToken();
      out({ token });
      break;
    }

    // ====== 帮助 ======
    default:
      out({
        usage: 'node scripts/index.js <command>',
        commands: {
          'list-workflows': 'list-workflows --user <userId>',
          'form-info': 'form-info <workflowId>',
          'user': 'user <name> <workCode>',
          'select-options': 'select-options <workflowId>',
          'browser-options': 'browser-options <workflowId>',
          'custom-browser': 'custom-browser <browserName> [--filter k=v]',
          'related-requests': 'related-requests --keyword <kw> --user <userId> [--days 30]',
          'diagnose': 'diagnose',
          'upload-file': 'upload-file <filePath> --user <userId>',
          'submit': 'submit <input.json> [--auto-submit]',
          'test-db': 'test-db',
          'get-token': 'get-token',
        },
      });
  }
}

main()
  .catch(err => { out({ error: err.message, stack: err.stack }); process.exit(1); })
  .finally(() => db.close().catch(() => {}));
