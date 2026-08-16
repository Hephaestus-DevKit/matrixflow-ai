# 部署手册

## 目标拓扑

- Web：Vercel（或任何支持 Next.js 15 的 Node.js 平台）。
- Backend：Appwrite Cloud Singapore 项目。
- Function：Appwrite Node.js 22 Runtime `matrixflow-core`。
- AI：Anthropic Messages 或 OpenAI Chat Completions，由函数变量提供密钥。

## 发布前

```bash
pnpm install --frozen-lockfile
npm ci --prefix apps/functions/matrixflow-core
pnpm verify
pnpm function:check
pnpm function:test
pnpm audit --prod --audit-level=high
npm audit --omit=dev --prefix apps/functions/matrixflow-core
```

确认 `appwrite.config.json` 与 `infra/appwrite` 的变更经过审查，且仓库、日志和构建产物中没有真实密钥。

## Appwrite 资源

创建短期 API key，通过环境变量注入，不写入 `.env`：

```bash
MATRIXFLOW_DEPLOY_KEY=... pnpm appwrite:provision
```

也可以使用不读取本地变量的显式部署命令，避免把 Console 中的 Secret 误覆盖：

```bash
appwrite functions create-deployment \
  --function-id matrixflow-core \
  --code apps/functions/matrixflow-core \
  --activate \
  --entrypoint src/main.js \
  --commands "npm ci --omit=dev"
```

日常发布不要加 `--with-variables`：该 CLI 选项会用本地清单替换函数变量，可能清掉 Console 中的 Secret。生产流水线使用幂等部署脚本，只更新受管的非敏感变量并保留模型密钥。当前线上还需要保留 `MATRIXFLOW_AGENT_LIMIT`、`MATRIXFLOW_CONTENT_PROJECT_LIMIT`、`MATRIXFLOW_KNOWLEDGE_BASE_LIMIT`、`MATRIXFLOW_WORKFLOW_LIMIT` 四个资源额度变量。

初始化脚本是幂等的，会创建或更新数据库、表权限、列、索引和文件桶。函数发布后，在 Appwrite Console 的 `matrixflow-core` 变量中设置协议与密钥，再部署一个新版本使变量生效：

```text
MATRIXFLOW_AI_PROVIDER=anthropic      # anthropic | openai | openai-compatible | glm | auto
ANTHROPIC_API_KEY=                   # 仅选择 anthropic 时需要
ANTHROPIC_MODEL=claude-3-5-haiku-latest
ANTHROPIC_BASE_URL=https://api.anthropic.com

# 或者：
MATRIXFLOW_AI_PROVIDER=openai-compatible
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MAX_TOKENS_FIELD=max_completion_tokens
```

可选的运营变量：

```text
# 仅用于内部用量统计，不会把价格展示为供应商承诺
MATRIXFLOW_AI_PRICING_JSON={"openai:gpt-4o-mini":{"inputPer1k":0.00015,"outputPer1k":0.0006}}

# 计费适配器的 HMAC secret；支付供应商事件先由你的适配层规范化为
# MatrixFlow billing webhook schema，再请求 /billing/webhook。
MATRIXFLOW_BILLING_WEBHOOK_SECRET=<secret>
MATRIXFLOW_BILLING_PROVIDER=stripe
MATRIXFLOW_PUBLIC_URL=https://matrixflow-ai.vercel.app
STRIPE_SECRET_KEY=<Appwrite Function secret>
STRIPE_PRICE_PRO=price_...
STRIPE_PRICE_TEAM=price_...
STRIPE_WEBHOOK_SECRET=<Stripe webhook signing secret>
MATRIXFLOW_ALLOW_TEST_BILLING=false

# 异步任务与连接器（均为 Function Secret/运营配置）
MATRIXFLOW_API_KEY_PEPPER=<random-32-plus-character-secret>
MATRIXFLOW_WORKER_SECRET=<random-32-plus-character-secret>
MATRIXFLOW_CONNECTOR_ALLOWLIST=api.example.com,*.trusted.example
MATRIXFLOW_REQUIRE_ASYNC=true
MATRIXFLOW_REQUIRE_BILLING=true

# Strict release evidence (CI/operations only; never expose in the browser):
MATRIXFLOW_ALERT_WEBHOOK_URL=https://alerts.example.com/matrixflow
MATRIXFLOW_BACKUP_EVIDENCE_URL=https://ops.example.com/backups/latest
MATRIXFLOW_BACKUP_LAST_SUCCESS_AT=2026-08-16T00:00:00.000Z
MATRIXFLOW_RESTORE_EVIDENCE_URL=https://ops.example.com/restores/latest
MATRIXFLOW_RESTORE_LAST_SUCCESS_AT=2026-08-01T00:00:00.000Z
```

计费事件必须使用原始请求体计算 `HMAC-SHA256`，通过
`X-MatrixFlow-Billing-Signature: sha256=<hex>` 发送；事件 ID 在
`billing_events` 中唯一去重。订阅权益只由 Function 根据 `subscriptions` 表判定，浏览器不能传入或覆盖套餐。

`OPENAI_BASE_URL` 支持任意遵循 Chat Completions 请求/响应结构的网关；官方 OpenAI 新模型默认使用 `max_completion_tokens`，旧版兼容网关可切换为 `max_tokens`。GLM 保留独立变量以兼容既有环境。`ANTHROPIC_API_KEY`、`OPENAI_API_KEY` 和 `GLM_API_KEY` 必须标记为 Secret，其他模型、端点和限流变量可以是普通变量。密钥永远不要放到 Web 环境变量或仓库。

自动部署由 `.github/workflows/appwrite.yml` 提供。主分支的后端或基础设施变更会依次执行测试、Schema 更新、Function 部署和可选 smoke test；如果仓库 Secret `MATRIXFLOW_DEPLOY_KEY` 缺失，任务会明确失败，不会把未发布的后端代码标记为成功。

如果 Secret 缺失，工作流会在运行摘要和警告中明确标记“未修改 Appwrite”，不能把绿色的跳过任务当作后端已发布。配置短期最小权限 key 后，应重新运行工作流，并在 Appwrite Console 核对 active deployment ID。

发布前可以先运行配置审计：

```bash
pnpm readiness:audit
pnpm readiness:audit:strict
```

普通审计允许 Free 预览环境缺少外部凭据并显示 WARN；严格审计要求真实 Provider、异步执行器、支付签名、连接器白名单、HTTPS 告警地址、近 26 小时备份、近 92 天恢复演练和短期部署 key 全部存在。严格审计通过只是配置门槛，仍需真实 smoke 和人工验收。

## Web 发布

设置公开变量：

```text
NEXT_PUBLIC_APPWRITE_ENDPOINT=https://sgp.cloud.appwrite.io/v1
NEXT_PUBLIC_APPWRITE_PROJECT_ID=<project-id>
```

如果使用自建或其他地域的 Appwrite，必须在构建时提供 endpoint；Next.js 会同步更新 CSP 与头像白名单。修改 Vercel 环境变量后需要重新部署，旧部署不会自动读取新端点。

Appwrite Web Platform 同时登记生产域名和 `localhost`。向 `main` 推送后由 Vercel 自动发布；发布状态成功后再切换流量。

## 验证

使用专用测试账号或一次性凭据运行 `scripts/smoke.mjs`，覆盖：

1. 登录和邮箱验证状态；
2. Appwrite Team 成员关系；
3. 客户端业务表创建被拒绝，Function 写入可被本团队读取；
4. `matrixflow-core` 的 `/health`；
5. Provider 已配置时执行一次真实、低 token 的 Agent 调用，并校验 Provider、协议、模型与非空输出；
6. 无论验证成功或失败都清理测试 Agent 和当前会话。

CI 中的生产部署 smoke 会设置 `MATRIXFLOW_REQUIRE_AI_SMOKE=true`：如果 Provider 未配置或真实调用失败，发布任务必须失败。手动诊断未配置 Provider 的环境时可以不设置该变量，此时脚本仍验证认证、租户边界和 Function，并明确报告 AI smoke 被跳过。

随后人工验证注册、登录、组织切换、知识库上传和工作流 true/false 分支。未配置 AI key 时应收到明确的 503 配置错误；这属于预期失败关闭。

## 收尾

- 撤销部署 API key，删除本地临时 key 文件。
- 删除 smoke test 数据和不需要的会话。
- 检查 GitHub CI、CodeQL、Vercel 和 Appwrite Function deployment 均为成功。
- 记录 deployment ID、Git commit 和回滚点。

## 回滚

- Web：在 Vercel 将上一个成功 deployment 设为生产。
- Function：在 Appwrite Deployments 中激活上一个成功 deployment。
- Schema：只做向后兼容扩展；删除列或表需先停止旧代码写入、备份数据并单独审批。
- 凭据泄露：先撤销/轮换，再调查日志，不能仅重新部署。
