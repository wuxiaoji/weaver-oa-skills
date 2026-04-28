# 规则文档写法

文件名：`{workflowId}-{流程名称}.md`

## 原则

**规则文档只写业务规则，不写字段信息。**

字段名称、类型、是否必填等信息全部从 `form-info` 命令实时查询，不在规则文档里重复声明。

## YAML 配置项

| 配置项 | 用途 | 示例 |
|--------|------|------|
| `autoFill` | 不需要问用户、脚本自动填的字段 | `sqr: user.person_id` |
| `detailAutoFill` | 选择浏览按钮后自动带出的关联值 | `je: standard.standard_amount` |
| `dataSources` | 特殊数据源查询命令 | `command: "custom-browser xxx --filter zj={user.job_level}"` |
| `calculations` | 计算公式 | `formula: "max(0, fyje - zrs * sjtw * je)"` |
| `summaryFields` | 主表汇总字段（从明细表计算） | `hjje: "sum(expenses.fyje)"` |
| `conditionalFields` | 条件逻辑（某字段值取决于条件） | `condition: "user.dept_id in list"` |
| `detailTableSemantics` | 多明细表的中文语义 | `dt1: 教育经历` |
| `constants` | 业务常量 | `nccDeptList: [61,108,...]` |

## 不应该写的内容

- 字段列表（从 form-info 查）
- 是否必填（从 form-info 查）
- 字段类型说明（从 form-info 查）
- 下拉选项列表（从 select-options 查）

## 自然语言部分

YAML 下方的 Markdown 正文用于补充 YAML 无法表达的逻辑，如：
- 复杂的业务流程说明
- 联动依赖关系的解释
- AI 收集信息的策略建议
