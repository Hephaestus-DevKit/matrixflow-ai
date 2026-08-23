# MatrixFlow AI

面向团队的 AI 运营工作台。前端使用 Next.js，身份、团队、业务数据、文件和受保护的 AI/工作流执行统一由 Appwrite 承载。

[![CI](https://github.com/Hephaestus-DevKit/matrixflow-ai/actions/workflows/ci.yml/badge.svg)](https://github.com/Hephaestus-DevKit/matrixflow-ai/actions/workflows/ci.yml)
[![CodeQL](https://github.com/Hephaestus-DevKit/matrixflow-ai/actions/workflows/codeql.yml/badge.svg)](https://github.com/Hephaestus-DevKit/matrixflow-ai/actions/workflows/codeql.yml)
[![Production smoke](https://github.com/Hephaestus-DevKit/matrixflow-ai/actions/workflows/production-smoke.yml/badge.svg)](https://github.com/Hephaestus-DevKit/matrixflow-ai/actions/workflows/production-smoke.yml)

> 当前版本定位：生产可用 Beta。公开体验、Appwrite 租户边界和 AI Provider 适配已可用于真实试用；Stripe 结账、外部连接器、企业 SSO、备份恢复演练和多区域 Worker 仍需按发布清单配置后，才适合承诺企业级 SLA。

发布前请运行 `corepack pnpm verify`、`corepack pnpm readiness:audit:strict`、`corepack pnpm test:e2e` 和 `corepack pnpm smoke:production`。严格就绪检查依赖 Appwrite/Vercel/告警/备份等外部证据；本地未配置这些凭证时失败是预期行为，不应通过关闭检查来绕过。

## 当前能力

- Appwrite Email/Password 登录、邮箱验证、团队成员关系和组织隔离。
- 可选 TOTP 双重验证、一次性恢复代码与登录设备管理；MFA 状态由 Appwrite Account 托管。
- 服务端角色校验、字段白名单、浏览器禁写数据表、按用户/API Key 的通用限流、原子 AI 月度额度与审计日志。
- AI 内容生成、Agent 运行、CRM 回复建议、知识库问答与本月用量记录；未配置模型密钥时明确显示不可用，不伪造结果。
- Provider 层支持 Anthropic Messages 与 OpenAI Chat Completions / compatible 协议，默认使用有界重试和配置池故障转移；端点强制 HTTPS，生产默认拒绝私网地址。
- PDF、DOCX、TXT、Markdown、CSV 文件上传、Team 权限校验、解析、相关片段检索、版本化重建、失败重试与同步删除。
- 可视化 DAG 工作流，支持不可变版本记录、有界校验、真实条件分支、运行日志和级联删除。
- Agent 与工作流运行会持久化开始/完成时间、Token、估算成本和重试关系；失败或已完成运行可通过受保护的 retry 路由安全重放，运行中的任务不会被误标记为可重试。
- Agent、工作流、批量内容和知识索引支持持久化后台任务：返回 202、可查询状态、原子租约、取消、心跳和有界重试；异步执行器未配置时明确失败。
- 统一的响应式工作台、AI 就绪状态、首次运行清单、团队创建与邮件邀请。
- 全站简体中文、繁體中文与 English 三语切换；语言选择会在刷新和认证页面间保持。
- Appwrite 原生升级申请闭环：定价页保留套餐意向，注册后直达计费页，团队成员可提交 Pro/Team 申请并由服务端去重、审计与后续结算适配器承接。
- Appwrite 配置即代码、幂等资源更新、独立后端部署流水线、云函数安全测试和真实 smoke test。
- 管理员只读运行健康面板展示 Function、Provider、异步 Worker 与计费依赖状态，不向浏览器暴露密钥。
- 统一错误边界、请求体与分页上限、租户归属不可变、Provider 端点规范化和生产级可观测请求 ID。
- 写入请求默认使用幂等键，上传、索引、资源创建在网络重试时不会重复落库；Free 预览会在服务端执行 AI 调用、AI 员工、内容项目、知识库和工作流额度。
- 套餐目录与权益由 Function 服务端统一判定；订阅状态、计费事件采用 Appwrite 表保存，并提供带 HMAC 签名校验和事件去重的 `/billing/webhook` 适配入口。没有配置支付供应商时仍保持 Free 预览，不会伪造扣款。
- 计费适配边界覆盖试用、逾期、拒付状态，以及发票、支付、退款和拒付交易记录；真实 checkout 仍需外部支付供应商配置。
- 已提供 Stripe Checkout 的服务端适配器；未配置 `STRIPE_SECRET_KEY` 与价格 ID 时安全返回未配置状态，不会伪造订单。
- 组织管理员可创建最小权限 API Key（哈希存储、作用域、过期与撤销），并使用标准 `Authorization` 与 `X-MatrixFlow-Organization` 调用受保护 API。
- 组织可导出脱敏数据，或在精确确认后删除业务数据；安全审计、订阅、发票、交易与计费事件按保留策略留存。
- AI 用量会按调用、输入/输出 Token、供应商/模型与可选价格表记录；成本缺少价格配置时显示为 0，不会推测或虚构费用。

生产环境：<https://matrixflow-ai.vercel.app>。生产前端部署在 Vercel，数据与 Function 部署在 Appwrite Cloud Singapore；生产 Function 的部署保留策略为 5 天，便于回滚同时避免无界堆积。

## 架构

```text
Browser / Next.js
  ├─ Account + Teams ───────────── Appwrite Auth
  ├─ permission-filtered reads ─── Appwrite TablesDB / Storage
  └─ all business writes ───────── MatrixFlow Core Function
                                      ├─ membership + role validation
                                      ├─ Zod field allowlists + audit
                                      ├─ Anthropic Messages / OpenAI Chat Completions
                                      ├─ durable background jobs + Appwrite async executions
                                      ├─ document parsing / chunk retrieval
                                      ├─ scoped API keys + data governance
                                      └─ quota-bounded workflow runtime
```

租户边界以 Appwrite Team ID 为唯一组织标识；浏览器只能读取已有团队行，业务写入全部经过云函数的成员、角色与字段校验。详细说明见 [架构文档](docs/architecture.md) 和 [安全文档](docs/security.md)。产品成熟度与外部发布条件见 [产品成熟度清单](docs/product-readiness.md)。

## 仓库结构

```text
apps/web/                              Next.js 产品界面与 Appwrite 数据适配层
apps/functions/matrixflow-core/        Appwrite 云函数、部署脚本与单元测试
packages/shared/                       前端共享类型与输入 Schema
infra/appwrite/                        数据表、索引、桶和函数声明
data/                                  产品模板源数据
docs/                                  架构、安全与产品资料
appwrite.config.json                   Appwrite 项目配置入口
```

## 本地运行

要求 Node.js 22.14+、pnpm 11。

```bash
corepack pnpm install --frozen-lockfile
cp .env.example .env.local
corepack pnpm dev
```

打开 `http://localhost:3000`。仓库已提供公开的 Appwrite endpoint 与 project ID 默认值；如果复制项目，请在 `.env.local` 中替换。公开页面、登录、注册、恢复密码和工作台均支持简体中文、繁體中文与 English。

AI 能力通过 Appwrite Function 统一接入两种协议：原生 Anthropic Messages API 和 OpenAI Chat Completions（因此也兼容 GLM、vLLM、LiteLLM、DeepSeek 等 OpenAI-compatible 网关）。密钥只放在云函数变量中，不得使用 `NEXT_PUBLIC_*` 或提交到仓库。

推荐在 `matrixflow-core` 函数变量中显式设置 `MATRIXFLOW_AI_PROVIDER`：

- `anthropic`：`ANTHROPIC_API_KEY`、`ANTHROPIC_MODEL`、可选 `ANTHROPIC_BASE_URL`。
- `openai` / `openai-compatible`：`OPENAI_API_KEY`、`OPENAI_MODEL`、可选 `OPENAI_BASE_URL`。
- `glm`：兼容旧部署的 `GLM_API_KEY`、`GLM_MODEL`、可选 `GLM_ENDPOINT`。
- `auto`（默认）：保持旧环境的 GLM 优先，同时在未配置 GLM 时自动选择 Anthropic 或 OpenAI。

Provider 层会统一处理系统提示、温度、`max_tokens`、top-p、超时、有限重试、429/5xx 错误映射、请求 ID、输入/输出用量、可选成本估算和跨协议故障转移。当前文本响应仍为非流式模式，工具调用和流式输出会在连接器能力开放后逐步启用；不会把未实现的能力伪装成成功。

### API Key 与异步任务

API Key 在“设置 → 企业设置与安全 → API 访问”创建，完整密钥只显示一次。自动化请求需要：

```http
Authorization: Bearer mf_live_<secret>
X-MatrixFlow-Organization: <team-id>
```

长任务在请求体中设置 `mode: "async"`，服务器返回 `202` 与 `jobId`，再使用 `GET /jobs/<job-id>` 查询或 `POST /jobs/<job-id>/cancel` 取消。完整契约见 [API 文档](docs/api.md)。

业务列表默认按团队过滤并限制单次最多加载 10,000 条，避免大数据量拖垮浏览器或函数执行；Agents、内容项目、知识库、知识文档、工作流和运行日志支持 `limit`/`offset` 分页并返回 `nextOffset`。工作台为资源列表提供本地化筛选、结果反馈和分页忙碌态。超过范围时会返回可重试的明确错误。普通业务行只读权限开放给团队成员，审计、用量、计费和幂等记录只能由 Function 访问。未知 Appwrite/上游异常只返回稳定的用户提示，详细内部信息不会回传到浏览器。

## 质量检查

```bash
corepack pnpm verify
corepack pnpm schema:check
corepack pnpm readiness:audit
corepack pnpm function:check
corepack pnpm function:test
corepack pnpm test:e2e
corepack pnpm audit --prod --audit-level=high
npm audit --omit=dev --prefix apps/functions/matrixflow-core
corepack pnpm smoke:production
```

生产公开 smoke 会分别携带简体中文、繁體中文与 English 的持久化语言 Cookie，校验服务端首屏的 `<html lang>`、标题和页面主体，避免只在 hydration 后看起来正确。

## Appwrite 部署

基础设施声明位于 `infra/appwrite`。幂等初始化脚本需要临时的最小权限 API key：

```bash
MATRIXFLOW_DEPLOY_KEY=... pnpm appwrite:provision
appwrite functions create-deployment --function-id matrixflow-core --code apps/functions/matrixflow-core --activate --entrypoint src/main.js --commands "npm ci --omit=dev"
```

部署后应立即撤销临时 key，并运行 `apps/functions/matrixflow-core/scripts/smoke.mjs` 验证登录、团队权限、浏览器禁写、服务端写入、函数健康状态和真实 Provider。仓库还提供 `.github/workflows/appwrite.yml`，在配置短期部署密钥后自动同步后端。发布、回滚和配置清单见 [部署手册](docs/deployment.md)，SLO、告警、事件与恢复标准见 [生产运行基线](docs/operations.md)。

## 能力边界

- 邮件与任意 Webhook 节点在安全连接器配置前会明确失败。
- 即使连接器未启用，Webhook 目标也必须通过 HTTPS、私网地址和出站白名单校验；真正发送前还需 OAuth/凭据保险箱。
- 市场支付与自助 checkout 仍需真实供应商，不会生成虚假订单或扣款；发票、退款和拒付数据模型已准备好。
- 知识库当前采用带 CJK 分词、标题加权、短语信号和定位引用的 lexical-hybrid 检索，适合中小型资料集；大规模语义检索需另行接入向量服务。
- 模板市场、外部 CRM 渠道和付费结账均以预览状态展示，不会伪造交易或发送消息。

贡献流程见 [CONTRIBUTING.md](CONTRIBUTING.md)，漏洞请按 [SECURITY.md](SECURITY.md) 私下报告。
