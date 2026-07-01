---
title: MatrixFlow AI API
emoji: 🐳
colorFrom: indigo
colorTo: blue
sdk: docker
app_port: 7860
pinned: false
---

# MatrixFlow AI 🚀

> **面向中小企业、出海团队与创作者的一站式 AI 员工操作系统与工作流自动化中心。**
> 允许团队在几分钟内创建、部署并管理具备专业技能的 AI 员工，支持可视化拖拽工作流画布、向量知识库（RAG）、内容工厂、客户关系管理（CRM）与模板市场。

[![Status](https://img.shields.io/badge/status-production--ready-success)]()
[![Stack](https://img.shields.io/badge/stack-Next.js%2014%20%7C%20NestJS%2010-blue)]()
[![Database](https://img.shields.io/badge/database-PostgreSQL%20%7C%20Redis%20%7C%20MinIO-indigo)]()
[![Security](https://img.shields.io/badge/security-enterprise--grade-red)]()

---

## 🌟 核心产品特性

* **📊 实时数据看板 (Analytics Dashboard)**：全维度监控系统级与团队级指标，如总执行耗时、接口吞吐量、活跃 AI 员工数与会话分析。
* **🤖 智能 AI 员工群 (AI Staffs)**：支持多模态 AI 岗位定制、技能树绑定与自动同步，配备高保真 Skeleton 卡片渐变闪烁交互。
* **⚙️ 可视化工作流引擎 (Visual Workflows)**：基于 React Flow 拖拽式画布，支持将 AI 决策节点、分支条件判定与第三方 API 粘合为多任务队列自动化管线。
* **📖 向量知识库 (Knowledge Base / RAG)**：深度集成 PostgreSQL + pgvector 向量检索，支持私有 PDF/Word 等多格式文档批量解析、智能分块与向量化。
* **🏬 模板交易市场 (Marketplace)**：预设丰富的官方/第三方商业化岗位与工作流模板，支持一键购买、克隆并热部署。

---

## 🛡️ 企业级高并发与安全架构

* **🔐 严格多租户数据隔离**：在 JWT 拦截层与 API 守卫自动提取并深度校验租户成员资格，配合 UUID 校验阻止一切数据跨越权漏洞。
* **⚡ 极速 JWT 验证缓存**：将 Appwrite 认证上下文基于 SHA-256 哈希缓存于 Redis 中（按租户隔离），使 API 接口鉴权延迟从 **~200ms 降至 <2ms**。
* **🔎 全链路 Request ID 链路追踪**：生成全局唯一追踪号 `mfa_req_*` 并通过响应头与 Pino 结构化日志串联，异常报错可在百万行日志中瞬间定位。
* **💎 鲁棒性与异常规整**：
  * **Zod 校验格式化**：将参数校验报错自动聚合成清晰友好的路径提示（如 `name: Required`），极大提升开发与交互体验。
  * **数据库连接池自愈**：通过 Prisma pg-Pool 显式在容器生命周期销毁时安全释放连接，防 Neon Serverless 数据库连接被撑爆。
  * **CORS 域限制**：支持在生产环境下限制跨域白名单（`CORS_ALLOWED_ORIGINS`）。

---

## 🛠️ 技术选型与仓库结构

```
matrixflow-ai/
├── apps/
│   ├── web/              # Next.js 14 前端 (Zustand + TanStack Query)
│   ├── api/              # NestJS 10 后端 (Express + Prisma 5 + Pino)
│   └── worker/           # BullMQ Background Workers (Redis 7)
├── packages/
│   ├── shared/           # 共享数据校验、Zod Schema 与常量定义
│   ├── db/               # Prisma Schema、自动生成客户端与迁移脚本
│   ├── ui/               # shadcn/ui 核心业务组件库
│   ├── ai-gateway/       # 统一 AI 大模型网关抽象 (流式输出 + 计量)
│   └── workflow-engine/  # 工作流 DSL + DAG 执行引擎
```

---

## ⚡ 极速本地启动

### 1. 克隆与安装依赖
```bash
pnpm install
```

### 2. 启动 Docker 基础设施
```bash
cp .env.example .env
docker compose up -d   # 包含 Postgres+pgvector, Redis, MinIO, MailHog
```

### 3. 初始化并写入种子数据
```bash
pnpm db:generate       # 生成 Prisma Client 客户端
pnpm db:migrate        # 应用数据库迁移 schema
pnpm db:seed           # 预植系统全局角色、菜单权限与 Prompt 模板
```

### 4. 启动多端开发服务器
```bash
pnpm dev               # 并行热启动前端 (3000)、API (3001) 与 Worker 进程
```

* 访问前端：[http://localhost:3000](http://localhost:3000)
* 后端文档（开发环境）：[http://localhost:3001/api/v1/docs](http://localhost:3001/api/v1/docs)

---

## 📃 License

Private. © 2026 MatrixFlow AI. 保留所有权利。
