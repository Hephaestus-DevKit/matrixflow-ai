# MatrixFlow AI · REST API 文档（§5）

> 静态接口概览：开发环境 `/api/v1/docs` 生成的 Swagger 文档和 Controller 实现是实时来源。生产默认使用 Appwrite 认证；`/auth/register`、`/auth/login`、`/auth/refresh`、`/auth/logout` 仅在 `AUTH_MODE=local` 或测试环境启用。

> Base URL: `http://localhost:3001/api/v1`
> 认证: Bearer JWT (Authorization header)
> 多租户: 所有业务接口自动注入 organizationId（从 JWT 解析）

---

## Auth 认证

### POST /auth/register

注册新用户，同时创建默认团队

```
Request:  { email: string, password: string, name: string }
Response: { data: { accessToken, refreshToken, user, organization } }
Status:   201 | 400 (duplicate email)
```

### POST /auth/login

```
Request:  { email: string, password: string }
Response: { data: { accessToken, refreshToken, user } }
Status:   201 | 401
```

### POST /auth/refresh

```
Request:  { refreshToken: string }
Response: { data: { accessToken, refreshToken } }
Status:   201 | 401
```

### GET /auth/me

```
Headers:  Authorization: Bearer <token>
Response: { data: { user, organization, role } }
Status:   200 | 401
```

---

## Organizations 团队

### GET /org

当前用户所属团队列表

### POST /org

创建新团队 `{ name, slug }`

### POST /org/:id/invite

邀请成员 `{ email, role: "owner"|"admin"|"member" }`

### PATCH /org/:id/members/:userId

修改角色 `{ role }`

### DELETE /org/:id/members/:userId

移除成员

---

## Agents AI 员工

### GET /agents

列表（含 skills/tools），按组织隔离

### POST /agents

创建 AI 员工

```
Request: {
  name: string,
  role: string,           // "copywriter"|"cs_agent"|"data_analyst"|...
  description?: string,
  model: string,          // "glm-4-plus"|"gpt-4o-mini"|...
  temperature?: number,   // 0-2, default 0.7
  maxTokens?: number,     // default 2000
  systemPrompt: object,   // { templateKey?, raw?, variables? }
  skills: [{ skillKey, config? }],
  tools: [{ toolKey, config? }]
}
```

### GET /agents/:id

详情（含 skills/tools/runs）

### PATCH /agents/:id

更新

### DELETE /agents/:id

软删除

### POST /agents/:id/run

运行 AI 员工（同步）

```
Request: { input: object }
Response: { data: { runId, output, usage } }
```

### POST /agents/:id/run/stream

运行 AI 员工（SSE 流式）

```
Response: text/event-stream
  data: {"chunk":"..."}
  data: {"chunk":"...","done":true,"usage":{...}}
```

### GET /agents/:id/runs

运行日志

### POST /agents/from-template/:templateId

从模板创建 `{ name?, overrides? }`

---

## Content 内容工厂

### GET /content/projects

项目列表

### POST /content/generate

生成内容

```
Request: {
  type: "product_title"|"listing"|"tiktok_script"|"instagram"|"facebook_ad"|"email_marketing"|"seo_blog"|"faq"|"landing_page"|"translation",
  productData?: object,
  productId?: string,
  language: string,       // "zh"|"en"|"ja"|...
  brandVoiceId?: string,
  options?: { platform?, maxLength?, audience?, duration? }
}
Response: { data: { item, usage } }
```

### POST /content/generate/stream

流式生成（SSE）

### GET /content/projects/:projectId/items

内容项列表

### GET /content/items/:id

内容详情（含版本/评分）

### GET /content/brand-voices

品牌语气列表

### POST /content/brand-voices

创建品牌语气 `{ name, toneRules, sampleText? }`

---

## Knowledge 知识库

### GET /kb

知识库列表

### POST /kb

创建知识库 `{ name, description? }`

### POST /kb/:id/documents

上传文档（multipart/form-data）

```
Fields: file (PDF/Word/Excel/TXT/Markdown)
Response: { data: { documentId, status: "pending" } }
```

### GET /kb/:id/documents

文档列表

### POST /kb/:id/query

RAG 问答

```
Request: { question: string, topK?: number }
Response: { data: { answer, sources: [{ content, documentName, score }], usage } }
```

### DELETE /kb/:id/documents/:docId

删除文档

---

## Workflows 工作流

### GET /workflows

列表

### POST /workflows

创建（DSL 格式）

```
Request: {
  name: string,
  description?: string,
  dsl: {
    nodes: [{ id, type, config?, position?: {x,y} }],
    edges: [{ source, target, condition?: "always"|"true"|"false"|"truthy"|"falsy" }]
  }
}
```

### GET /workflows/:id

详情（含版本/触发器）

### POST /workflows/:id/versions

保存新版本 `{ dsl, changeNote? }`（版本原子递增）

### POST /workflows/:id/run

提交异步工作流运行

```
Request: { input: object }
Response: { runId, status: "PENDING" }
```

### GET /workflows/:id/logs

执行日志

### GET /workflows/:id/export

导出名称、描述和最新 DSL

---

## CRM 客户管理

### GET /crm/customers

客户列表（支持搜索/筛选/分页）

### POST /crm/customers

创建客户 `{ name, email?, phone?, tags? }`

### GET /crm/customers/:id

客户详情（含对话/标签/线索）

### PATCH /crm/customers/:id

更新

### GET /crm/leads

销售线索列表

### POST /crm/leads

创建线索 `{ customerId, source, note? }`

### GET /crm/conversations

对话列表

### POST /crm/conversations/:id/messages

发送消息 `{ content, role: "user"|"assistant" }`

### POST /crm/conversations/:id/suggest

AI 回复建议

---

## Marketplace 模板市场

### GET /marketplace

公开模板列表（支持搜索/分类/排序）

### GET /marketplace/:id

模板详情

### POST /marketplace

发布模板 `{ type, name, description, data, priceUsd? }`

### POST /marketplace/:id/purchase

购买模板

### POST /marketplace/:id/install

安装到当前组织

### POST /marketplace/:id/reviews

评分评论 `{ rating: 1-5, comment? }`

---

## Billing 计费

### GET /billing/plans

套餐列表

### GET /billing/current

当前订阅

### POST /billing/subscribe

开通免费订阅或委托付费结账 `{ planId, interval?: "month"|"year" }`

### GET /billing/usage

用量统计（按月）

### GET /billing/invoices

发票列表

### GET /billing/tokens

本月 Token 用量明细

---

## Admin 管理后台

### GET /admin/users

用户管理（分页）

### PATCH /admin/users/:id

修改用户状态 `{ status: "ACTIVE"|"SUSPENDED" }`

### GET /admin/stats

系统统计

### GET /admin/model-stats

模型调用监控

### GET /admin/pending-templates

待审核模板

### PATCH /admin/templates/:id/approve

审核通过

### PATCH /admin/templates/:id/reject

审核拒绝 `{ reason }`

### GET /admin/audit-logs

审计日志

---

## 通用错误格式

```json
{
  "statusCode": 400,
  "message": "Validation error",
  "error": "Bad Request",
  "code": "VALIDATION_ERROR"
}
```

## 错误码表

| code              | statusCode | 说明                   |
| ----------------- | ---------- | ---------------------- |
| VALIDATION_ERROR  | 400        | 请求参数校验失败       |
| NOT_FOUND         | 404        | 资源不存在             |
| UNAUTHORIZED      | 401        | 未认证                 |
| FORBIDDEN         | 403        | 权限不足               |
| CONFLICT          | 409        | 资源冲突（如重复邮箱） |
| RATE_LIMITED      | 429        | 限流                   |
| AI_PROVIDER_ERROR | 502        | AI 供应商调用失败      |
| QUOTA_EXCEEDED    | 403        | 用量超限               |
