---
title: MatrixFlow AI API
emoji: 🐳
colorFrom: indigo
colorTo: blue
sdk: docker
app_port: 7860
pinned: false
---

# MatrixFlow AI

面向中小团队的 AI 员工、内容生成、知识库 RAG、CRM 与可视化工作流平台。

[![Status](https://img.shields.io/badge/status-beta-yellow)]()
[![Stack](https://img.shields.io/badge/stack-Next.js%2015%20%7C%20NestJS%2011-blue)]()
[![Runtime](https://img.shields.io/badge/runtime-Node.js%2022%20%7C%20pnpm%2011-indigo)]()
[![Database](https://img.shields.io/badge/database-PostgreSQL%20%7C%20Redis%20%7C%20MinIO-indigo)]()

## 当前能力

- AI 员工、内容工厂、CRM、组织与 RBAC。
- PostgreSQL + pgvector 知识库，支持 PDF、DOCX、TXT、Markdown、CSV。
- React Flow 工作流编辑器；AI、条件、转换和受 SSRF 防护的 Webhook 节点可执行。
- BullMQ 文档与工作流异步任务，带重试、退避和数据库执行租约。
- Appwrite 生产认证、本地开发认证、原子 Refresh Token 轮换和多租户隔离。
- 全局限流、AI 超时、私有 MinIO、真实 readiness、版本化 Prisma migration。

邮件、人工审批、调度和循环工作流节点尚未接入适配器。Stripe 上线前，付费订阅和付费市场交易返回 HTTP 402，不会生成虚假支付状态。

## 仓库结构

```text
matrixflow-ai/
├─ apps/
│  ├─ web/                 Next.js 前端
│  ├─ api/                 NestJS HTTP API 与业务模块
│  ├─ worker/              BullMQ 消费者
│  └─ sidecar/             Python 文档解析服务
├─ packages/
│  ├─ shared/              常量、Schema 与 DTO
│  ├─ db/                  Prisma Client、Schema、migration、seed
│  ├─ ai-gateway/          模型 Provider 与 Prompt 网关
│  ├─ workflow-engine/     与框架无关的 DAG 校验/执行核心
│  └─ ui/                  共享 UI 组件
├─ scripts/                构建辅助、容器启动、测试数据工具
├─ data/                   产品模板源数据
├─ infra/                  独立生产镜像定义
└─ docs/                   架构、安全、运维与产品资料
```

详细职责、依赖方向和扩展约定见 [架构说明](docs/architecture.md)。文档入口见 [docs/README.md](docs/README.md)。

## 本地开发

要求：Node.js ≥ 22.13、pnpm 11.9、Docker Compose。

```bash
pnpm install --frozen-lockfile
cp .env.example .env
```

至少配置：

```dotenv
APPWRITE_PROJECT_ID=your-project-id
NEXT_PUBLIC_APPWRITE_PROJECT_ID=your-project-id
INTERNAL_JOB_SECRET=generate-a-random-secret-at-least-32-characters
GLM_API_KEY=your-key
```

启动基础设施并初始化数据库：

```bash
docker compose up -d postgres redis minio minio-init sidecar mailhog
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm dev
```

服务地址：

- Web：http://localhost:3000
- API：http://localhost:3001/api/v1
- Swagger（非生产）：http://localhost:3001/api/v1/docs
- MinIO Console：http://localhost:9001
- MailHog：http://localhost:8025

需要完整容器化环境时运行：

```bash
docker compose up -d --build
```

## 常用命令

| 命令 | 用途 |
|---|---|
| `pnpm dev` | 启动 Web、API、Worker 和各包 watch |
| `pnpm build` | 构建全部 workspace |
| `pnpm typecheck` | TypeScript 类型检查 |
| `pnpm lint` | ESLint 检查 |
| `pnpm test` | Node 单元测试 |
| `pnpm db:migrate` | 应用版本化 migration |
| `pnpm db:seed` | 写入基础套餐与模板 |
| `pnpm audit --prod --audit-level=high` | 生产依赖审计 |

## 发布门禁

```bash
pnpm install --frozen-lockfile
pnpm db:generate
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm audit --prod --audit-level=high
```

CI 会额外启动 PostgreSQL/pgvector 和 Redis，执行 migration、API E2E 与生产 API 镜像构建。生产配置、部署顺序和剩余外部依赖见 [生产就绪说明](docs/production-readiness.md)；已实现和待实现的安全控制见 [安全状态](docs/security.md)。

## 维护约定

- API 业务按 `controller → service → infrastructure` 组织；跨域复用逻辑下沉到 `packages/`。
- 所有数据库变更必须新增 migration，禁止生产使用 `prisma db push`。
- Worker 只负责消费队列；受保护的业务执行仍由 API 内部端点完成。
- 新环境变量必须同步更新 `.env.example` 和生产环境校验。
- 不提交 `.env`、生成 Client、构建产物、缓存、Python 字节码或临时数据集。

## License

Private. © 2026 MatrixFlow AI. 保留所有权利。
