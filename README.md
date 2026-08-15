# MatrixFlow AI

面向团队的 AI 运营工作台。前端使用 Next.js，身份、团队、业务数据、文件和受保护的 AI/工作流执行统一由 Appwrite 承载，不再依赖 Hugging Face、PostgreSQL、Redis、MinIO 或常驻 Worker。

[![CI](https://github.com/Hephaestus-DevKit/matrixflow-ai/actions/workflows/ci.yml/badge.svg)](https://github.com/Hephaestus-DevKit/matrixflow-ai/actions/workflows/ci.yml)
[![CodeQL](https://github.com/Hephaestus-DevKit/matrixflow-ai/actions/workflows/codeql.yml/badge.svg)](https://github.com/Hephaestus-DevKit/matrixflow-ai/actions/workflows/codeql.yml)

## 当前能力

- Appwrite Email/Password 登录、邮箱验证、团队成员关系和组织隔离。
- 可选 TOTP 双重验证、一次性恢复代码与登录设备管理；MFA 状态由 Appwrite Account 托管。
- 服务端角色校验、字段白名单、浏览器禁写数据表、月度额度、分钟级限流和审计日志。
- AI 内容生成、Agent 运行、CRM 回复建议、知识库问答与本月用量记录；未配置模型密钥时明确显示不可用，不伪造结果。
- PDF、DOCX、TXT、Markdown、CSV 文件上传、解析、相关片段检索、失败重试与同步删除。
- 可视化 DAG 工作流，支持不可变版本记录、有界校验、真实条件分支、运行日志和级联删除。
- Agent 与工作流运行会持久化开始/完成时间、Token、估算成本和重试关系；失败或已完成运行可通过受保护的 retry 路由安全重放，运行中的任务不会被误标记为可重试。
- 统一的响应式工作台、AI 就绪状态、首次运行清单、团队创建与邮件邀请。
- 全站简体中文、繁體中文与 English 三语切换；语言选择会在刷新和认证页面间保持。
- Appwrite 原生升级申请闭环：定价页保留套餐意向，注册后直达计费页，团队成员可提交 Pro/Team 申请并由服务端去重、审计与后续结算适配器承接。
- Appwrite 配置即代码、幂等资源更新、独立后端部署流水线、云函数安全测试和真实 smoke test。
- 统一错误边界、请求体与分页上限、租户归属不可变、Provider 端点规范化和生产级可观测请求 ID。
- 写入请求默认使用幂等键，上传、索引、资源创建在网络重试时不会重复落库；Free 预览会在服务端执行 AI 调用、AI 员工、内容项目、知识库和工作流额度。
- 套餐目录与权益由 Function 服务端统一判定；订阅状态、计费事件采用 Appwrite 表保存，并提供带 HMAC 签名校验和事件去重的 `/billing/webhook` 适配入口。没有配置支付供应商时仍保持 Free 预览，不会伪造扣款。
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
                                      ├─ document parsing / chunk retrieval
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
pnpm install --frozen-lockfile
cp .env.example .env.local
pnpm dev
```

打开 `http://localhost:3000`。仓库已提供公开的 Appwrite endpoint 与 project ID 默认值；如果复制项目，请在 `.env.local` 中替换。公开页面、登录、注册、恢复密码和工作台均支持简体中文、繁體中文与 English。

AI 能力通过 Appwrite Function 统一接入两种协议：原生 Anthropic Messages API 和 OpenAI Chat Completions（因此也兼容 GLM、vLLM、LiteLLM、DeepSeek 等 OpenAI-compatible 网关）。密钥只放在云函数变量中，不得使用 `NEXT_PUBLIC_*` 或提交到仓库。

推荐在 `matrixflow-core` 函数变量中显式设置 `MATRIXFLOW_AI_PROVIDER`：

- `anthropic`：`ANTHROPIC_API_KEY`、`ANTHROPIC_MODEL`、可选 `ANTHROPIC_BASE_URL`。
- `openai` / `openai-compatible`：`OPENAI_API_KEY`、`OPENAI_MODEL`、可选 `OPENAI_BASE_URL`。
- `glm`：兼容旧部署的 `GLM_API_KEY`、`GLM_MODEL`、可选 `GLM_ENDPOINT`。
- `auto`（默认）：保持旧环境的 GLM 优先，同时在未配置 GLM 时自动选择 Anthropic 或 OpenAI。

Provider 层会统一处理系统提示、温度、`max_tokens`、top-p、超时、有限重试、429/5xx 错误映射、请求 ID、输入/输出用量与可选成本估算。当前以同步文本模式运行，工具调用和流式输出会在连接器能力开放后逐步启用；不会把未实现的能力伪装成成功。

业务列表默认按团队过滤并限制单次最多加载 10,000 条，避免大数据量拖垮浏览器或函数执行；超过范围时会返回可重试的明确错误。普通业务行只读权限开放给团队成员，审计、用量、计费和幂等记录只能由 Function 访问。未知 Appwrite/上游异常只返回稳定的用户提示，详细内部信息不会回传到浏览器。

## 质量检查

```bash
pnpm verify
pnpm function:check
pnpm function:test
pnpm audit --prod --audit-level=high
npm audit --omit=dev --prefix apps/functions/matrixflow-core
pnpm smoke:production
```

## Appwrite 部署

基础设施声明位于 `infra/appwrite`。幂等初始化脚本需要临时的最小权限 API key：

```bash
MATRIXFLOW_DEPLOY_KEY=... pnpm appwrite:provision
appwrite functions create-deployment --function-id matrixflow-core --code apps/functions/matrixflow-core --activate --entrypoint src/main.js --commands "npm ci --omit=dev"
```

部署后应立即撤销临时 key，并运行 `apps/functions/matrixflow-core/scripts/smoke.mjs` 验证登录、团队权限、浏览器禁写、服务端写入和函数健康状态。仓库还提供 `.github/workflows/appwrite.yml`，在配置短期部署密钥后自动同步后端。发布、回滚和配置清单见 [部署手册](docs/deployment.md)。

## 能力边界

- 邮件与任意 Webhook 节点在安全连接器配置前会明确失败。
- 市场支付仍为产品边界，不会生成虚假订单或扣款。
- 知识库当前采用带 CJK 分词、标题加权、短语信号和定位引用的 lexical-hybrid 检索，适合中小型资料集；大规模语义检索需另行接入向量服务。
- 模板市场、外部 CRM 渠道和付费结账均以预览状态展示，不会伪造交易或发送消息。

贡献流程见 [CONTRIBUTING.md](CONTRIBUTING.md)，漏洞请按 [SECURITY.md](SECURITY.md) 私下报告。
