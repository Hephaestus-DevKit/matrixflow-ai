# MatrixFlow AI

面向团队的 AI 运营工作台。前端使用 Next.js，身份、团队、业务数据、文件和受保护的 AI/工作流执行统一由 Appwrite 承载，不再依赖 Hugging Face、PostgreSQL、Redis、MinIO 或常驻 Worker。

[![CI](https://github.com/Hephaestus-DevKit/matrixflow-ai/actions/workflows/ci.yml/badge.svg)](https://github.com/Hephaestus-DevKit/matrixflow-ai/actions/workflows/ci.yml)
[![CodeQL](https://github.com/Hephaestus-DevKit/matrixflow-ai/actions/workflows/codeql.yml/badge.svg)](https://github.com/Hephaestus-DevKit/matrixflow-ai/actions/workflows/codeql.yml)

## 当前能力

- Appwrite Email/Password 登录、邮箱验证、团队成员关系和组织隔离。
- 服务端角色校验、字段白名单、浏览器禁写数据表、月度额度、分钟级限流和审计日志。
- AI 内容生成、Agent 运行、CRM 回复建议、知识库问答与本月用量记录；未配置模型密钥时明确显示不可用，不伪造结果。
- PDF、DOCX、TXT、Markdown、CSV 文件上传、解析、相关片段检索、失败重试与同步删除。
- 可视化 DAG 工作流，支持不可变版本记录、有界校验、真实条件分支、运行日志和级联删除。
- 统一的响应式工作台、AI 就绪状态、首次运行清单、团队创建与邮件邀请。
- Appwrite 配置即代码、幂等资源更新、独立后端部署流水线、云函数安全测试和真实 smoke test。

## 架构

```text
Browser / Next.js
  ├─ Account + Teams ───────────── Appwrite Auth
  ├─ permission-filtered reads ─── Appwrite TablesDB / Storage
  └─ all business writes ───────── MatrixFlow Core Function
                                      ├─ membership + role validation
                                      ├─ Zod field allowlists + audit
                                      ├─ GLM or OpenAI
                                      ├─ document parsing / chunk retrieval
                                      └─ quota-bounded workflow runtime
```

租户边界以 Appwrite Team ID 为唯一组织标识；浏览器只能读取已有团队行，业务写入全部经过云函数的成员、角色与字段校验。详细说明见 [架构文档](docs/architecture.md) 和 [安全文档](docs/security.md)。

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

打开 `http://localhost:3000`。仓库已提供公开的 Appwrite endpoint 与 project ID 默认值；如果复制项目，请在 `.env.local` 中替换。

AI 能力需要在 Appwrite Console 的 `matrixflow-core` 函数变量中设置 `GLM_API_KEY` 或 `OPENAI_API_KEY`。密钥只放在云函数变量中，不得使用 `NEXT_PUBLIC_*` 或提交到仓库。

## 质量检查

```bash
pnpm verify
pnpm function:check
pnpm function:test
pnpm audit --prod --audit-level=high
npm audit --omit=dev --prefix apps/functions/matrixflow-core
```

## Appwrite 部署

基础设施声明位于 `infra/appwrite`。幂等初始化脚本需要临时的最小权限 API key：

```bash
MATRIXFLOW_DEPLOY_KEY=... pnpm appwrite:provision
appwrite push functions
```

部署后应立即撤销临时 key，并运行 `apps/functions/matrixflow-core/scripts/smoke.mjs` 验证登录、团队权限、浏览器禁写、服务端写入和函数健康状态。仓库还提供 `.github/workflows/appwrite.yml`，在配置短期部署密钥后自动同步后端。发布、回滚和配置清单见 [部署手册](docs/deployment.md)。

## 能力边界

- 邮件与任意 Webhook 节点在安全连接器配置前会明确失败。
- 市场支付仍为产品边界，不会生成虚假订单或扣款。
- 知识库当前采用分块关键词相关性检索与定位引用，适合中小型资料集；大规模语义检索需另行接入向量服务。
- 模板市场、外部 CRM 渠道和付费结账均以预览状态展示，不会伪造交易或发送消息。

贡献流程见 [CONTRIBUTING.md](CONTRIBUTING.md)，漏洞请按 [SECURITY.md](SECURITY.md) 私下报告。
