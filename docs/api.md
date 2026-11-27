# MatrixFlow API

MatrixFlow 的业务 API 由 Appwrite Function `matrixflow-core` 提供。浏览器继续使用 Appwrite 会话；自动化脚本可以使用带作用域的 MatrixFlow API Key。

生产业务入口为 `https://6a7b1d40001e62963eec.sgp.appwrite.run`。团队管理员可在「设置 → 企业设置与安全 → 数据与隐私」导出数据，从 JSON 的 `organizationId` 读取团队 ID。

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

把 API Key 和团队 ID 放入调用环境后，可用无请求体的 `GET` 验证连接。

```bash
curl --fail-with-body https://6a7b1d40001e62963eec.sgp.appwrite.run/health \
  -H "Authorization: Bearer $MATRIXFLOW_API_KEY" \
  -H "X-MatrixFlow-Organization: $MATRIXFLOW_TEAM_ID"
```

请求体需要是 JSON 对象。非空且无效的 JSON 返回 HTTP 400 和 `INVALID_JSON`。

## 响应契约

成功响应统一包含 `data` 和 `meta.requestId`；错误响应包含稳定的 `error.code`、用户可读的 `error.message` 和 `error.requestId`。所有写请求建议通过标准 `Idempotency-Key` 请求头携带客户端生成的幂等键（8–128 个安全字符）；Web 客户端也可使用内部请求体字段 `__idempotencyKey`。两者同时存在时必须一致。Function 会先通过唯一索引原子占用该 Key，再执行业务并提交响应；并发重复请求会返回 `IDEMPOTENCY_IN_PROGRESS`，等价 JSON 不受字段顺序影响，完成后的同一团队、方法、路径和请求指纹在 24 小时内会重放成功响应。

请求指纹包含调用者身份和当前角色/作用域。其他用户、其他 API Key 或权限变更后的请求不能重放旧响应。API Key 创建是一次性密钥响应的例外：首次请求返回完整密钥，但幂等记录只保存 `API_KEY_SECRET_UNAVAILABLE` 错误；同一幂等键重试返回 HTTP 409，且不会重复创建密钥。如首次响应丢失，应撤销已创建的密钥后重新创建。

成功响应超过幂等记录大小上限时仍保留完成标记，同一请求重试返回 HTTP 409 和 `IDEMPOTENCY_REPLAY_UNAVAILABLE`，不会再次执行。此时应读取资源状态核实结果。

数据库暂时无法确认提交结果时，`CONTENT_WRITE_UNCONFIRMED` 或 `KNOWLEDGE_INDEX_UNCONFIRMED` 会保留活动的幂等占用。重试前先读取项目、草稿或索引状态。

## 长任务

Agent、工作流、内容生成、知识库索引和问答支持 `mode: "async"`。服务器返回 HTTP 202，任务 ID 位于响应的 `data.id`。用这个 ID 查询或取消任务：

```http
GET /jobs/<job-id>
POST /jobs/<job-id>/cancel
```

后台任务状态包括 `QUEUED`、`RUNNING`、`RETRY_WAIT`、`SUCCEEDED`、`FAILED` 和 `CANCELED`。异步执行必须配置 `MATRIXFLOW_WORKER_SECRET` 与 Appwrite `executions.write` scope；缺少配置时会明确返回 `ASYNC_WORKER_NOT_CONFIGURED`。

Shopify 批量翻译通过 `POST /content/projects/:id/translations/:batch` 提交，返回 HTTP 202。任务详情的 `progress` 提供 `processed` 和 `total`，结果包括 `completed`、`skipped`、`failed` 和对应字段的错误码。任务按字段持久化，跳过在等待期间被修改的草稿。

工作台任务列表使用 `GET /jobs?limit=25&offset=0` 分页读取，只返回状态展示所需的脱敏字段；任务参数、结果、错误详情和 Worker 租约不会进入列表响应。任务详情与取消操作仍由 Function 执行授权与状态转换。

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

## 内容审核与 Shopify

以下端点需要 `content.manage`。查询后台任务进度还需要 `workflows.manage`。外部系统可在导入后读取批次字段，提交翻译并轮询任务，完成后重新读取草稿和 `revision`，审核通过后导出。修改商品资料或草稿时携带读到的当前 `revision`，并发变更会返回 HTTP 409。

| 方法与路径                                            | 请求或响应                                                                                                                          |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `PUT /content/projects/:id/facts`                     | 提交 `{ description, revision }`，返回更新后的项目。                                                                                |
| `PUT /content/items/:id/review`                       | 提交 `{ text, reviewed, revision }`，返回保存后的审核版本。                                                                         |
| `GET /content/items/:id/delivery`                     | 返回已审正文、审核版本与检索引用。                                                                                                  |
| `POST /content/projects/:id/translations`             | 提交 `{ filename, headers, rows }`，返回批次 ID 与导入行数。                                                                        |
| `GET /content/projects/:id/translations/:batch/items` | 返回 `{ items }`，每项含 `id`、商品编号 `identification`、`field`、`locale`、`market`、`source`、`text`、`revision` 和 `reviewed`。 |
| `POST /content/items/:id/translate`                   | 提交 `{ revision }`，返回单字段译文草稿。                                                                                           |
| `POST /content/projects/:id/translations/:batch`      | 提交 `{ items: [{ id, revision }] }`，创建后台翻译任务。                                                                            |
| `GET /content/projects/:id/translations/:batch`       | 返回已审字段的 `{ headers, rows, reviews }`。                                                                                       |

## 版本与兼容性

响应 `meta.apiVersion` 标识当前契约日期。新增字段保持向后兼容；删除或改变字段前必须先在 `packages/shared`、Function schema、前端适配层和回归测试中完成迁移。
