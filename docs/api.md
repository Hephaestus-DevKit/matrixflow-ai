# MatrixFlow API

MatrixFlow 的业务 API 由 Appwrite Function `matrixflow-core` 提供。浏览器继续使用 Appwrite 会话；自动化脚本可以使用带作用域的 MatrixFlow API Key。

## 认证

创建 API Key：登录工作台后进入“设置 → 企业设置与安全 → API 访问”。只有组织 owner/admin 可以创建和撤销 Key。完整密钥只返回一次，服务端使用生产 pepper 保护的 PBKDF2-HMAC-SHA256（120,000 次迭代）保存派生值；生产缺少 `MATRIXFLOW_API_KEY_PEPPER` 时会安全拒绝 API Key 操作。

```http
Authorization: Bearer mf_live_<secret>
X-MatrixFlow-Organization: <team-id>
Content-Type: application/json
```

API Key 只允许访问创建时授予的作用域：

- `agents.manage`
- `content.manage`
- `knowledge.manage`
- `workflows.manage`
- `crm.manage`
- `billing.read`

不要把 API Key 放进浏览器代码、日志、Issue 或 URL 查询参数。发现泄露时立即在设置中心撤销并重新创建。

## 响应契约

成功响应统一包含 `data` 和 `meta.requestId`；错误响应包含稳定的 `error.code`、用户可读的 `error.message` 和 `error.requestId`。所有写请求建议通过标准 `Idempotency-Key` 请求头携带客户端生成的幂等键（8–128 个安全字符）；Web 客户端也可使用内部请求体字段 `__idempotencyKey`。两者同时存在时必须一致。Function 会先通过唯一索引原子占用该 Key，再执行业务并提交响应；并发重复请求会返回 `IDEMPOTENCY_IN_PROGRESS`，等价 JSON 不受字段顺序影响，完成后的同一团队、方法、路径和请求指纹在 24 小时内会重放成功响应。

## 长任务

Agent、工作流、批量内容和知识索引支持 `mode: "async"`。服务器返回 HTTP 202 和 `jobId`，任务状态通过以下端点查询：

```http
GET /jobs/<job-id>
POST /jobs/<job-id>/cancel
```

后台任务状态包括 `QUEUED`、`RUNNING`、`RETRY_WAIT`、`SUCCEEDED`、`FAILED` 和 `CANCELED`。异步执行必须配置 `MATRIXFLOW_WORKER_SECRET` 与 Appwrite `executions.write` scope；缺少配置时会明确返回 `ASYNC_WORKER_NOT_CONFIGURED`。

CRM 客户列表使用显式分页：`GET /crm/customers?limit=50&offset=0` 返回 `data`、`total`、`limit`、`offset` 和 `nextOffset`。客户端不应一次性拉取整个客户库。

Agents、内容项目、知识库和工作流列表也支持同样的分页参数：

```http
GET /agents?limit=50&offset=0
GET /content/projects?limit=50&offset=0
GET /kb?limit=50&offset=0
GET /workflows?limit=50&offset=0
GET /kb/<knowledge-base-id>?limit=20&offset=0
GET /workflows/<workflow-id>/logs?limit=25&offset=0
```

列表和工作流日志的分页响应返回 `data`、`total`、`limit`、`offset` 和 `nextOffset`；知识库详情保留知识库字段，并额外返回 `documentsPage` 和当前页 `documents`。不带分页参数时保留兼容响应。生产客户端应优先使用分页形式，避免把大型组织的全部资源一次性加载进浏览器。

## 关键端点

| 用途               | 方法   | 路径                    |
| ------------------ | ------ | ----------------------- |
| 健康检查           | GET    | `/health`               |
| 管理健康诊断       | GET    | `/admin/health`         |
| API Key 列表       | GET    | `/api-keys`             |
| API Key 创建       | POST   | `/api-keys`             |
| API Key 撤销       | DELETE | `/api-keys/:id`         |
| 组织数据导出       | GET    | `/account/export`       |
| 组织数据删除       | DELETE | `/account`              |
| 发票               | GET    | `/billing/invoices`     |
| 支付/退款/拒付交易 | GET    | `/billing/transactions` |
| 支付配置状态       | GET    | `/billing/config`       |
| 创建托管结账       | POST   | `/billing/checkout`     |

`/account` 删除需要管理员权限，并在请求体中精确提交 `confirmation: <team-id>`；安全审计、订阅、发票、交易和计费事件按保留策略保留，接口会返回逐表删除清单。

`/admin/health` 仅允许 owner/admin 会话访问，返回发布版本、Function/Provider/异步 Worker/计费就绪状态和不含密钥的 AI 协议信息；API Key 即使拥有业务作用域也不能调用管理员接口。

Stripe 供应商回调使用服务端地址 `/billing/stripe-webhook`，由 Stripe 签名验证后再进入内部账单事件流程；它不接受浏览器请求，也不应暴露在前端代码中。

## 版本与兼容性

响应 `meta.apiVersion` 标识当前契约日期。新增字段保持向后兼容；删除或改变字段前必须先在 `packages/shared`、Function schema、前端适配层和回归测试中完成迁移。
