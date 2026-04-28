---
workflowId: "*"
name: 通用流程处理指引
version: 2

# 通用自动回填（按中文名匹配）
autoFillByLabel:
  申请人: user.person_id
  制单人: user.person_id
  申请部门: user.dept_id
  申请日期: today
  制单日期: today
  申请人职位: user.job_title_id
  申请人职级: user.job_level
  工号: user.work_code
  办公地点: user.location
  部门信息: user.dept_id
  职位信息: user.job_title_id
  手机号: user.phone_number
  手机全号: user.phone_number
  使用人岗位: user.job_title_name
  岗位: user.job_title_name
  岗位id: user.job_title_id
  使用人姓名: user.person_id
  所在部门: user.dept_id
  发起人姓名: user.person_id
  发起部门: user.dept_id
---

# 通用流程处理指引

当流程没有专属规则文档时，AI 按以下步骤处理：

## Step 1: 查表单结构

`node scripts/index.js form-info <workflowId>` 返回所有字段的完整属性（类型、必填、隐藏等）。以此为准，不靠猜。
给用户展示数据时，**必须以该表单结构结果为基准**，将获取到的信息填充进去展示给用户，缺少的必须主动向用户索要。
特别注意：**请确保在所有的流程中默认的申请人=person_name（或person_id，由字段类型决定），工号=work_code，部门信息=dept_name（或dept_id），职级=job_level，办公地点=location，职位信息=job_title_name（或job_title_id）。所有的相关字段都要默认填充对应信息。**

## Step 2: 处理每个字段

- `skip: true` → 废弃字段，不传
- `hidden: true` → 隐藏字段，不传
- `mandatory: true` → 必须有值，追问用户或从已知信息推断
- `mandatory: false` → 即使是选填字段，也要求所有字段都要填写，缺失的必须问用户要，除非用户明确确认留空
- 选择框 / 浏览按钮 → 先查选项，让用户选
- `likely_system: true` → 可能是系统字段，但不要自动跳过，检查是否有其他字段依赖它

## Step 3: 附件

URL / OA路径 → 直接传。本地文件 / base64 → 先 upload-file 拿 docid。

## Step 4: 提交

默认草稿（autoSubmit=false），除非用户明确要求发起。

### ⚠️ 自动提交警告（强制）

如果用户明确要求自动提交流程（autoSubmit=true），AI **必须**先向用户发出以下警告，**待用户确认后**方可执行：

> ⚠️ **请注意：流程数据由AI自动生成并提交，提交后后果自负。请确认数据无误后再继续。**

用户未明确确认前，**禁止**执行 autoSubmit=true。

## Step 5: 遇到搞不定的字段

向用户求助，不要猜值。
