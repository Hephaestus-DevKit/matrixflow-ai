# MatrixFlow AI · 开发路线图

> 对应主文档 §14。本文件为执行版路线图，每个里程碑给出明确交付与验收。

## M0 基础设施（第 1 周） ✅
- monorepo 骨架（pnpm + turbo）
- Prisma schema 50+ 表 + pgvector
- docker-compose（PG / Redis / MinIO / MailHog）
- seed 数据（Plans / ModelCosts / Prompt / Agent Templates）

**验收**：`docker compose up -d && pnpm db:migrate && pnpm db:seed` 全部成功。

## M1 认证 + AI Gateway（第 2 周） ✅
- Auth：注册/登录/刷新/登出/me
- Organization + RBAC（owner/admin/member）
- AI Gateway：GLM Provider + OpenAI fallback + 流式 + token 计量 + 缓存 + 限流
- Prompt 模板渲染

**验收**：能注册登录、能调 GLM 流式输出、token 写入 `token_usage` 表。

## M2 AI 员工 + 内容工厂（第 3-4 周） ✅ → MVP Demo
- Agent CRUD + 从模板创建 + 运行 + 日志
- Content Factory：15 类内容生成 + 一键全量
- 前端：Dashboard + Agent 列表/详情/新建 + 内容工厂

**验收**：上传商品资料 → 一键生成 15 类内容 → 全部入库。

## M3 知识库 + 工作流（第 5-7 周） ✅
- KB：上传/解析/分块/向量化/RAG问答/引用
- Workflow：DSL + DAG 执行器 + 版本 + 运行日志 + 导出模板
- 前端：KB 列表/详情/上传/RAG + Workflow 编辑器（React Flow）

**验收**：上传 PDF → 自动分块向量化 → RAG 问答带引用；拖拽建工作流 → 运行成功。

## M4 CRM + 客服（第 8-9 周） ✅
- Customer / Lead / Conversation / Message
- AI 自动回复 + 对话总结 + 跟进任务
- 前端：客户列表/详情/对话中心/线索

**验收**：能管客户、能 AI 生成客服回复、能总结对话。

## M5 市场 + 计费（第 10-11 周） ✅
- Marketplace：发布/购买/安装/评分
- Billing：Plan / Subscription / Usage / Invoice / Token cost
- 前端：市场列表/详情/购买 + 计费页/用量页

**验收**：能上架模板、能购买、能订阅升级、能看用量。

## M6 Admin + 网页生成器（第 12 周） ⏳
- Admin：用户/组织/收入/模型监控/模板审核/审计日志
- AI 网页生成器：落地页/商品页/预览/导出
- 数据驾驶舱：用量/内容/客服/销售漏斗/老板日报

## M7 测试 + 靶署（第 13 周） ⏳
- 单元测试 + e2e + AI 输出评测
- CI/CD（GitHub Actions）
- 生产部署文档（Docker / Nginx / HTTPS）
- 监控告警（OpenTelemetry + Sentry）

## 三年路线图
| 时间 | ARR 目标 | 阶段 |
|------|----------|------|
| 0-3 月 | 种子 100 付费 | MVP |
| 3-6 月 | $50K | 收费版 |
| 6-12 月 | $500K | 平台化 |
| 12-24 月 | $2M | 生态化 |
| 24-36 月 | $20M+ | 规模化 |
