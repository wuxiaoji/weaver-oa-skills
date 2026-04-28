# Weaver Workflow Skill (泛微OA流程创建通用技能)

这是一个用于与泛微 OA (Ecology 9) 进行深度交互并自动创建和提交流程的 AI 技能 (Skill)。

## 🎯 使命与架构

本项目的设计理念是：**脚本负责能力，规则负责约束，AI 负责理解和决策。**

- **脚本层 (`scripts/`)**：只提供与泛微 OA 系统交互的原子能力（如查询、组装、上传、提交），不做任何业务逻辑的硬编码判断。
- **规则层 (`rules/`)**：通过 Markdown + YAML 的形式为每个流程定义专属规则，声明字段映射、计算公式、特殊约束等。
- **AI 智能体**：负责读取规则文档，调用脚本查询数据，向用户发起追问，组装最终参数并调用提交脚本。

## 📂 目录结构

```text
workflow-skill/
├── SKILL.md             # 技能元数据与 AI 行为准则
├── README.md            # 项目说明文档
├── rules/               # 业务规则定义目录
│   ├── default.md       # 默认通用规则
│   ├── 141-加班申请流程.md
│   ├── 173-员工入职.md
│   └── ...              # 其他特定流程的规则文档
└── scripts/             # Node.js 核心脚本
    ├── index.js         # CLI 统一入口
    ├── api/             # OA API 接口封装 (列表、查询、创建、附件)
    ├── core/            # 核心模块 (数据库操作 db.js、鉴权 auth.js)
    ├── data-source/     # 数据源查询 (HRM 员工信息、浏览框、自定义数据)
    ├── probe/           # 探测模块 (表单结构探测、下拉/浏览框选项获取)
    └── submit/          # 流程数据组装与提交流程
```

## 🛠️ 核心能力与命令 (CLI)

统一通过 `node scripts/index.js` 调用，所有命令输出纯 JSON，便于 AI 直接解析。

常用命令列表：
- `list-workflows --user <userId>`: 获取用户可用的流程列表
- `form-info <workflowId>`: 探测并获取指定流程的表单完整结构
- `user <name> <workCode>`: 查询人员基本信息（用于字段自动回填）
- `select-options <workflowId>`: 获取表单中下拉框的选项列表
- `browser-options <workflowId>`: 获取表单中浏览按钮的选项列表
- `upload-file <filePath> --user <userId>`: 上传本地附件并获取 `docid`
- `submit <input.json> [--auto-submit]`: 提交组装好的流程数据（默认存为草稿）

## 📜 规则层说明 (Rules)

每个特定流程都应在 `rules/` 目录下有一个对应的 Markdown 文件（如 `173-员工入职.md`）。
- **YAML Front Matter**: 包含机器可读的配置，如 `autoFillByLabel`（自动回填映射）、`skipFields`（跳过字段）等。
- **Markdown 正文**: 包含自然语言补充说明，指导 AI 如何处理多明细表、计算公式及特殊业务逻辑。

如果某个流程没有专属规则文档，AI 将退化使用 `rules/default.md` 中的通用规则。

## 🤖 AI 行为规范

1. **规则优先**：创建流程前，永远优先读取对应的 `rules/{workflowId}-*.md`。
2. **拒绝盲猜**：遇到下拉框、浏览框必须通过命令查出选项让用户选择，不能让用户盲填 ID。
3. **基于表单基准**：展示和索要数据必须以 `form-info` 查出的表单结构为基准，绝不遗漏 `likely_system: true` 等必须回填的字段。
4. **附件处理**：本地附件必须先调用 `upload-file` 接口换取 `docid`。
5. **安全提交流程**：默认只创建草稿 (`autoSubmit: false`)。若要直接发起，必须先向用户发出风险警告并获得确认。
