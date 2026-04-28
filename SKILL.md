---
name: weaver-workflow
description: "泛微OA（Ecology 9）流程创建通用技能。当用户需要创建任何泛微OA流程（如差旅费报销、员工入职、采购申请等）时触发。提供流程发现、表单探测、选项查询、附件上传、草稿创建、审批发起等能力。针对特殊流程（如差旅报销）通过 rules/ 目录下的规则文档提供业务约束。"
---

# 泛微OA流程创建通用技能

## 这个 Skill 的使命

**脚本负责能力，规则负责约束，AI 负责理解和决策。**

- 脚本层（scripts/）：只提供原子能力（查询、组装、上传、提交），不做业务判断
- 规则层（rules/）：每个流程一份 Markdown + YAML，声明字段映射、计算公式、特殊约束
- AI（你）：读规则、查数据、向用户追问、组装参数、调用脚本

---

## ⚠ AI 行为强制规则

### 规则 1：永远先读规则文档

当用户要求创建流程时，第一步不是查表单，而是：

```bash
# 1. 如果用户没说清楚要创建哪个流程
node scripts/index.js list-workflows --user <userId>

# 2. 拿到 workflowId 后，读对应的规则文档
读取 rules/{workflowId}-*.md
# 如果该 workflowId 没有专属规则文档，读 rules/default.md
```

规则文档的 YAML front matter 是机器可读的配置（字段映射、计算公式），正文是自然语言补充说明。两部分都要读。

### 规则 2：选择优先，禁止让用户填 ID

遇到下拉框（html_type=5）或浏览按钮（html_type=3）字段时：

1. 先调用 `select-options` / `browser-options` / `data-source` 等命令拿选项列表
2. 把选项展示给用户，让用户选编号
3. 取 `value` 字段作为传参

**禁止**直接问"请输入费用类型代码"、"请输入部门ID"这种填空题。

### 规则 3：附件必须先上传再引用

泛微附件不是单独接口上传，而是：

1. 如果 `filePath` 是 URL 或 `/weaver/ecology/filesystem/` 路径 → 直接使用
2. 如果 `filePath` 是本地路径或 base64 → 先调用 `upload-file` 命令拿到 docid
3. 附件字段 `fieldValue` 传 `docid,docid,docid` 逗号分隔字符串

### 规则 4：默认创建草稿，不自动发起

- 默认：`autoSubmit: false`，流程创建后停在草稿状态
- 只有用户明确说"直接提交"、"发起流程"、"走审批"时才传 `autoSubmit:确认过自动提交确认过自动提交之前必须告知用户风险（流程数据由AI自动生成并提交，提交后后果自负）
-- **所有流程标题自动加 "AI创建-" 前缀**（脚本层自动处理，AI 传 requestName 时不需要手动加）

### 规则 5：全面收集与基于表单的展示原则

`form-info` 返回的每个字段带完整属性（类型、必填、隐藏等），**这是唯一的字段信息来源**。
规则文档（rules/*.md）**不重复声明字段信息**，只写业务规则（公式、联动、条件逻辑）。

**核心约束：**
1. **所有字段都要填写**：对于表单中定义的字段，缺少的、或者系统没有自动获取到的信息，**必须主动问用户要**，不允许擅自留空或凭空猜测。
2. **以表单结果为基准进行展示**：在向用户展示数据或确认需要补充的信息时，**必须以查询到的表单结构结果（`form-info`）为基准**，将表单中的有效字段一一列出，去填充已有的信息给用户展示，并清晰指出还需要补充哪些字段。

- `mandatory: true` → 必填，AI 必须追问用户或从已知信息推断
- `mandatory: false` → 选填（也应尽量收集，如缺失应由用户确认无需填写）
- `hidden: true` → 隐藏字段，不传值
- `skip: true` → 废弃字段（label含"废弃"），不传值
- `likely_system: true` → **必须填充，禁止跳过！** 这只是标记"系统可能自动回填"，但 AI **必须主动填充**。优先从 `user` 命令返回的数据中获取（phone_number、job_title_name、job_title_id 等），如果数据源中没有该字段，**必须向用户询问**，绝不允许留空。

### 规则 6：多明细表识别

`form-info` 返回的 `detailTables` 是数组，可能有多张明细表（如员工入职流程 173 有 6 张明细表）。
AI 要根据规则文档判断每张明细表的语义，分别组装数据。

### 规则 7：超标/业务计算/流程规则交给规则文档

如差旅报销的超标公式 `MAX(0, fyje - zrs × sjtw × je)`，这类公式写在规则文档的 YAML 里，AI 严格按公式计算，不自己发明。

### 规则 8：联动依赖字段必须传值

浏览按钮（html_type=3）的选项列表通常有**联动过滤**——它的过滤 SQL 依赖其他字段的值。

例如：费用类型浏览框的过滤条件是 `WHERE zj = $sqrzj$`（按申请人职级过滤）。
如果 API 创建流程时没有传 `sqrzj`（申请人职级），那用户在网页端打开草稿、点击费用类型修改时，选项列表会是空白的。

**AI 必须检查规则文档的 `autoFill` 部分，确保所有联动依赖字段都有值。**

`form-info` 返回的字段带 `likely_system: true` 标记的是"可能系统回填"的文本字段。**但 AI 绝不能依赖系统自动回填而跳过填充！**

**强制规则：**
- `likely_system: true` 的字段 **100% 必须填充**，除非规则文档的 `skipFields` 明确列出
- 优先从 `user` 命令返回的数据中获取：`phone_number`（手机号）、`job_title_name`（岗位名称）、`job_title_id`（岗位ID）、`work_code`（工号）、`dept_name`（部门名称）等
- 如果 `user` 返回数据中没有对应字段 → **必须向用户询问**，禁止留空
- **禁止以系统会自动回填为由跳过任何字段**

### 规则 9：批量处理每条数据必须独立查询，禁止复用/默认值

**这是最容易违反的规则。** 当用户要求批量创建多条流程（或一条流程含多行明细）时，AI 容易在处理第一条后"偷懒"，对后续条目使用默认值或凭记忆填写。这会导致严重的数据错误。

**绝对禁止的行为：**
- ❌ 未明确信息就按默认值填写,比如差旅费报销中的第一条费用类型查了选项得到 ID=15，第二条不查直接填 ID=1
- ❌ 用户给了3条费用明细，只有第一条按职级查了费用标准，后面两条用"默认值"
- ❌ 把某个选项的 ID 硬编码（如 fylx1=1），而不是从查询结果中获取

**必须遵守的流程：**
1. 每一条明细行 / 每一个流程实例，浏览按钮和选择框字段的值都必须来自查询结果
2. 如果多条明细使用同一个费用类型名称，可以复用同一次查询的结果，但 value 必须从结果中按名称精确匹配，不能凭印象
3. 如果用户给的费用类型名称在查询结果中找不到精确匹配，必须向用户确认，不能退化为默认值
4. 提交前，AI 必须逐条检查每行明细的关键字段（如 fylx1/fybz/je/sx）是否都有正确的值

**自检清单（每条明细都要过一遍）：**
```
□ fylx1 的值是否来自 custom-browser 查询结果的 value 字段？
□ fybz/je/sx 是否来自该费用类型对应的 raw 数据？
□ cbje 是否按公式独立计算过？
□ 是否有任何字段使用了硬编码的默认值？（如果有 → 错误）
```

---

## 典型工作流（以差旅报销为例）

```
用户："帮我创建一个差旅费报销-测试流程，马田，RH0758"
  ↓
AI: 1. 读取 rules/309-差旅费报销.md（知道差旅报销流程 ID=309、有哪些特殊字段）
    2. node scripts/index.js user 马田 RH0758
       → 拿到 person_id, dept_id, job_title_id, job_level
    3. node scripts/index.js form-info 309
       → 拿到所有字段定义 + 必填属性
    4. node scripts/index.js select-options 309
       → 拿到"报销公司"等下拉选项
    5. node scripts/index.js custom-browser feiyongbiaozhun1fy --filter zj=4B
       → 拿到该职级下的费用类型选项
    6. node scripts/index.js related-requests --keyword 出差 --user 399 --days 30
       → 拿到近30天可关联的出差流程
    7. 向用户追问：
       - 报销公司？（展示选项让用户选）
       - 费用明细？（费用类型从选项选，填金额、人数、天数、地点、发票日期）
       - 出差报告附件？
       - 关联哪条出差流程？（展示选项让用户选）
    8. AI 严格按规则文档的公式算超标金额，超标时让用户填原因
    9. 附件先上传拿 docid
   10. 组装 input.json，调用 node scripts/index.js submit input.json
   11. 默认草稿模式（autoSubmit=false）
```

---

## 命令清单

所有命令统一用 `node scripts/index.js <command>`，输出都是 JSON。

| 命令 | 说明 |
|------|------|
| `list-workflows --user <userId>` | 列出用户能创建的流程 |
| `form-info <workflowId>` | 查表单结构（主表+多明细表+必填属性） |
| `user <name> <workCode>` | 查申请人信息 |
| `select-options <workflowId>` | 查所有下拉框选项 |
| `browser-options <workflowId>` | 查所有浏览按钮选项（按 fielddbtype 分派） |
| `data-source <fielddbtype>` | 手动查某种数据源（hrm/dept/jobtitle 等） |
| `custom-browser <browserName> [--filter k=v]` | 查自定义浏览按钮 uf_xxx |
| `related-requests --keyword <kw> --user <id> --days <n>` | 查关联流程 |
| `upload-file <path>` | 上传附件，返回 docid |
| `submit <input.json>` | 提交流程（默认草稿，加 --auto-submit 发起审批） |
| `diagnose` | 探测关键表结构 |

---

## 规则文档写法

见 `rules/README.md`。

## 对未知流程的处理

如果用户要创建的流程没有规则文档，AI 读 `rules/default.md` 按通用步骤处理。遇到搞不定的特殊字段（如陌生的浏览按钮），**向用户求助**而不是猜。
