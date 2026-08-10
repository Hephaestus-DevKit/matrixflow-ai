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

面向团队的多租户 AI 运营平台，包含 AI 内容生成、知识库 RAG、CRM、市场和可视化工作流。

[![CI](https://github.com/Hephaestus-DevKit/matrixflow-ai/actions/workflows/ci.yml/badge.svg)](https://github.com/Hephaestus-DevKit/matrixflow-ai/actions/workflows/ci.yml)
[![CodeQL](https://github.com/Hephaestus-DevKit/matrixflow-ai/actions/workflows/codeql.yml/badge.svg)](https://github.com/Hephaestus-DevKit/matrixflow-ai/actions/workflows/codeql.yml)
[![Node](https://img.shields.io/badge/Node.js-22-43853d)](https://nodejs.org/)
[![pnpm](https://img.shields.io/badge/pnpm-11-f69220)](https://pnpm.io/)

> 当前版本为 beta。计费与邮件已定义稳定的端口/适配器边界，但默认未绑定生产 Provider；人工审批、调度和循环工作流也仍处于显式受限状态。未配置能力会明确失败，不会伪造成功。

## 已实现能力

- Appwrite 生产认证与本地开发认证、组织/RBAC、Refresh Token 原子轮换。
- AI 内容生成、流式输出、Provider fallback、用量核算、缓存和 Prompt 输入/输出校验；取消信号、瞬时错误重试和流式回退均有明确边界。
- PostgreSQL + pgvector 知识库，支持 PDF、DOCX、TXT、Markdown 和 CSV。
- CRM 客户、线索、会话和消息，并在服务层强制组织隔离。
- React Flow 工作流；共享强类型 DSL 支持真实条件分支、AI、转换、可插拔邮件，以及受 DNS 固定与 SSRF 防护的 Webhook 节点。
- BullMQ 文档/工作流任务，带重试、退避、幂等 job ID 和数据库执行租约。
- 私有 MinIO、真实 liveness/readiness、Prometheus 指标、结构化日志与版本化 migration。
- 响应式 Web 工作台，具备移动导航、暗/亮主题、统一加载/错误/空状态、键盘焦点与组织切换缓存隔离。

## 仓库结构

```text
matrixflow-ai/
├─ apps/
│  ├─ web/                 Next.js 前端
│  ├─ api/                 NestJS API 与业务模块
│  ├─ worker/              BullMQ 消费者
│  └─ sidecar/             Python 文档解析服务
├─ packages/
│  ├─ shared/              常量、Zod Schema 与跨端类型
│  ├─ db/                  Prisma Schema、migration 与 seed
│  ├─ ai-gateway/          AI Provider、fallback 与流协议
│  └─ workflow-engine/     框架无关的 DAG 校验/执行核心
├─ infra/docker/           API、Worker 独立生产镜像
├─ scripts/                容器启动与维护脚本
├─ data/                   产品模板源数据
└─ docs/                   架构、安全、部署与产品资料
```

依赖边界和扩展约定见 [架构说明](docs/architecture.md)，文档总入口见 [docs/README.md](docs/README.md)。

## 快速开始

要求：Node.js 22、pnpm 11、Docker Compose。

```bash
pnpm install --frozen-lockfile
cp .env.example .env
docker compose up -d postgres redis minio minio-init sidecar
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm dev
```

至少需要设置 Appwrite 项目、一个 AI Provider 密钥、对象存储和两个内部长随机密钥；受限环境可通过显式开关降级运行认证核心服务。完整说明见 [.env.example](.env.example)。本地服务默认地址：

- Web：`http://localhost:3000`
- API：`http://localhost:3001/api/v1`
- Swagger（非生产）：`http://localhost:3001/api/v1/docs`
- Metrics：`http://localhost:3001/api/v1/metrics`（需要 `x-metrics-token`）
- MinIO Console：`http://localhost:9001`

完整容器环境：

```bash
docker compose up -d --build
```

## 工程命令

| 命令                                      | 用途                        |
| ----------------------------------------- | --------------------------- |
| `pnpm dev`                                | 启动各 workspace 的开发进程 |
| `pnpm format:check`                       | 检查格式                    |
| `pnpm typecheck`                          | TypeScript 类型检查         |
| `pnpm lint`                               | ESLint 检查                 |
| `pnpm test`                               | Node 单元测试               |
| `pnpm test:coverage`                      | 单元测试与分包覆盖率门禁    |
| `pnpm --filter @matrixflow/api test:e2e`  | API 集成测试                |
| `python -m unittest -v`（`apps/sidecar`） | Sidecar 单元测试            |
| `pnpm build`                              | 构建全部 workspace          |
| `pnpm audit --prod --audit-level=high`    | 生产依赖审计                |

CI 会运行格式、类型、lint、带覆盖率门禁的测试、API 集成测试和 Sidecar 测试，并构建 API、Worker、Sidecar 和 Hugging Face 组合镜像。生产发布顺序、回滚与 smoke test 见 [生产部署手册](docs/production-readiness.md)。

## 维护原则

- 租户 ID 只来自已验证认证上下文；所有组织数据查询必须显式带 `organizationId`。
- HTTP 输入先通过共享 Zod Schema；禁止直接展开客户端对象写入数据库。
- 数据库变更只能新增 Prisma migration，生产禁止 `prisma db push`。
- Worker 只负责队列消费；核心业务和授权仍在 API 服务层。
- 外部支付、邮件等能力通过领域端口接入；默认禁用适配器必须 fail closed。
- 新环境变量必须同步更新 `.env.example`、生产校验和部署文档。
- 不提交密钥、生成 Client、构建产物、缓存、Python 虚拟环境或临时数据。

贡献流程见 [CONTRIBUTING.md](CONTRIBUTING.md)，安全问题请按 [SECURITY.md](SECURITY.md) 私下报告。

## License

Proprietary. Source availability does not grant permission to use, copy, modify, or redistribute. See [LICENSE](LICENSE).
