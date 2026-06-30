# MatrixFlow AI

> **给中小企业雇一整支 AI 团队的操作系统。**
> 让用户在 30 分钟内创建、配置、管理和出售 AI 员工 — 接入知识库、工具、工作流、CRM、内容工厂、客服、数据看板和模板市场。

[![status](https://img.shields.io/badge/status-MVP%20demo-blue)]()
[![license](https://img.shields.io/badge/license-private-red)]()
[![stack](https://img.shields.io/badge/stack-TypeScript%20%7C%20NestJS%20%7C%20Next.js-green)]()

---

## 一句话定位

**MatrixFlow AI = 跨境电商 AI 内容工厂 + AI 员工工作台**（MVP），逐步扩展为面向中小企业、创作者团队、AI 服务商的 AI 员工操作系统与模板市场生态。

完整规划见 [`docs/00-MASTER-PLAN.md`](./docs/00-MASTER-PLAN.md)。

---

## 技术栈

| 层 | 选型 |
|----|------|
| Monorepo | pnpm workspace + Turborepo |
| 前端 | Next.js 14 (App Router) · React 18 · TypeScript · Tailwind CSS · shadcn/ui · React Flow · TanStack Query · Zustand |
| 后端 | NestJS 10 · TypeScript · Prisma 5 · PostgreSQL 16 + pgvector · Redis 7 · BullMQ · MinIO |
| AI | 自定义 Provider 抽象（GLM 主，OpenAI/Claude/Gemini 预留）· 流式输出 · token 计量 · Prompt 模板版本化 |
| 部署 | Docker Compose (MVP) → Kubernetes (P2) · Nginx · GitHub Actions CI/CD |

---

## 仓库结构

```
matrixflow-ai/
├── apps/
│   ├── web/              # Next.js 前端
│   ├── api/              # NestJS 后端
│   └── worker/           # BullMQ Worker
├── packages/
│   ├── shared/           # 共享类型 / Zod schema / 常量
│   ├── db/               # Prisma schema + client + migrations
│   ├── ui/               # shadcn/ui + 业务组件
│   ├── ai-gateway/       # AI Provider 抽象 + Prompt 模板
│   └── workflow-engine/  # 工作流 DSL + DAG 执行器
├── infra/
│   ├── docker/
│   └── k8s/              # (P2)
├── docs/                 # 所有文档
├── scripts/              # seed / 迁移 / 数据生成器
└── docker-compose.yml    # 本地基础设施
```

---

## 快速开始

### 前置要求
- Node.js ≥ 20.10
- pnpm ≥ 9
- Docker + Docker Compose

### 1. 安装依赖
```bash
pnpm install
```

### 2. 启动基础设施
```bash
cp .env.example .env
docker compose up -d   # Postgres+pgvector, Redis, MinIO, MailHog
```

### 3. 初始化数据库
```bash
pnpm db:generate       # 生成 Prisma Client
pnpm db:migrate        # 创建 schema
pnpm db:seed           # 写入 seed 数据（角色 / 套餐 / Prompt 模板）
```

### 4. 启动开发服务
```bash
pnpm dev               # 同时启动 web (3000) + api (3001) + worker
```

访问：
- 前端 http://localhost:3000
- API http://localhost:3001/api/v1
- MinIO 控制台 http://localhost:9001 (matrixflow / matrixflow123)
- MailHog http://localhost:8025

---

## 开发命令

| 命令 | 作用 |
|------|------|
| `pnpm dev` | 并行启动所有服务（热重载） |
| `pnpm build` | 构建所有包 |
| `pnpm typecheck` | 全仓 TypeScript 类型检查 |
| `pnpm lint` | ESLint |
| `pnpm test` | 全部测试 |
| `pnpm db:migrate` | 应用 Prisma 迁移 |
| `pnpm db:seed` | 写入种子数据 |
| `pnpm db:studio` | Prisma Studio |
| `pnpm infra:up` / `infra:down` | 启停 Docker 基础设施 |

---

## 里程碑进度

| 里程碑 | 状态 | 交付能力 |
|--------|------|----------|
| M0 基础设施 | ✅ 进行中 | monorepo + DB + docker |
| M1 认证 + AI Gateway | ⏳ | 登录 + 调 GLM 流式输出 |
| M2 AI 员工 + 内容工厂 | ⏳ | **MVP Demo**：上传商品→生成 15 类内容 |
| M3 知识库 + 工作流 | ⏳ | RAG + 可视化工作流 |
| M4 CRM + 客服 | ⏳ | 客户管理 + AI 客服 |
| M5 市场 + 计费 | ⏳ | 模板交易 + 收费 |
| M6 Admin + 网页生成器 | ⏳ | 管理后台 + 落地页生成 |
| M7 测试 + 部署 | ⏳ | CI/CD + 上线 |

---

## 文档索引

- [`docs/00-MASTER-PLAN.md`](./docs/00-MASTER-PLAN.md) — 项目主文档（唯一权威规划）
- `docs/ROADMAP.md` — 五阶段开发路线图（待生成）
- `docs/api/` — API 规范（OpenAPI 自动生成）
- `docs/marketing/` — 市场运营内容
- `docs/security.md` — 安全合规方案

---

## License

Private. © 2026 MatrixFlow AI.
