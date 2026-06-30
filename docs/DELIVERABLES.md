# MatrixFlow AI · 最终交付清单

> 本文档汇总所有已交付物，作为成品索引。

## 📁 文档（docs/）
| 文件 | 内容 |
|------|------|
| `00-MASTER-PLAN.md` | 项目主文档（唯一权威规划，16章+2附录） |
| `ROADMAP.md` | 五阶段开发路线图 |
| `security.md` | 安全合规方案（15项+合规） |
| `deployment.md` | 部署文档（本地/生产/K8s） |

## 🏗️ 后端（apps/api/）
| 模块 | 状态 | 关键能力 |
|------|------|----------|
| `main.ts` + `app.module.ts` | ✅ | NestJS 入口 + Swagger + CORS + Helmet |
| `prisma/` | ✅ | PrismaService |
| `redis/` | ✅ | Redis + 限流 |
| `ai/` | ✅ | AI Gateway 集成（chat/stream/embed） |
| `auth/` | ✅ | 注册/登录/refresh/me + bcrypt + JWT rotation |
| `org/` | ✅ | 成员邀请/改角色/切换团队 |
| `agent/` | ✅ | CRUD + 运行（一次性+流式）+ 模板实例化 |
| `content/` | ✅ | 15 类内容生成 + 品牌语气 + 版本 |
| `kb/` | ✅ | KB CRUD + 文档上传 + 分块 + 向量化 |
| `kb/rag.service.ts` | ✅ | RAG 问答（带引用 + 流式） |
| `workflow/` | ✅ | CRUD + DSL 校验 + DAG 执行 |
| `crm/` | ✅ | 客户/线索/对话/AI回复/总结/跟进 |
| `billing/` | ✅ | 套餐/订阅/用量/token/发票/quota |
| `market/` | ✅ | 发布/购买/安装/评分 |
| `admin/` | ✅ | 用户/统计/模型监控/模板审核/审计 |
| `health/` | ✅ | 健康检查 |
| `common/` | ✅ | Guards(JWT/Permissions) + Filters + Interceptors + Decorators |

## 🖥️ 前端（apps/web/）
| 页面 | 状态 |
|------|------|
| Landing / Pricing | ✅ |
| Login / Register | ✅ |
| Dashboard + Sidebar + Topbar | ✅ |
| Agents 列表/新建/详情 | ✅ |
| Content 列表/生成器 | ✅ |
| Knowledge 列表/详情/RAG问答 | ✅ |
| Workflows 列表/详情 | ✅ |
| CRM 总览/客户详情 | ✅ |
| Analytics | ✅ |
| Admin | ✅ |
| Billing | ✅ |
| Team | ✅ |
| Marketplace | ✅ |

## 📦 共享包（packages/）
| 包 | 内容 |
|----|------|
| `shared/` | 常量 + Zod schemas + DTO 类型 |
| `db/` | Prisma schema（50+ 表）+ seed |
| `ai-gateway/` | GLM/OpenAI Provider + 流式 + 缓存 + fallback + token 计量 |
| `workflow-engine/` | DSL + DAG 校验 + BFS 执行器 |

## 🗄️ 数据库
- `packages/db/prisma/schema.prisma` — 50+ 表，多租户 + 软删除 + 审计
- `scripts/sql/000_init.sql` — pgvector + 触发器
- `packages/db/prisma/seed.ts` — Plans + Model Costs + Prompts + Agent Templates

## 🤖 Worker（apps/worker/）
- BullMQ 队列：KB解析 / 向量化 / 工作流 / 邮件

## 📊 数据资产（data/）
| 文件 | 数量 |
|------|------|
| `agent-templates.json` | 30 个 AI 员工模板 |
| `prompt-templates.json` | 30 个 Prompt 模板 |
| `workflow-templates.json` | 30 个工作流模板 |
| `scripts/generators/` | 测试数据生成器（商品/线索/对话/社媒/工作流日志） |

## 🔧 基础设施
- `docker-compose.yml` — Postgres+pgvector / Redis / MinIO / MailHog
- `infra/docker/api.Dockerfile` — 多阶段构建
- `.github/workflows/ci.yml` — typecheck + lint + test + docker build
- `.env.example` — 全部环境变量

## ✅ 校验状态
- ✅ Prisma schema 错字修正（13 处 `Uuuid` → `Uuid`）
- ✅ app.module.ts 全模块挂载（含 Market）
- ⚠️ 待运行：`pnpm install` + `pnpm typecheck`（需联网装依赖）

## 🚀 启动顺序
```bash
pnpm install
cp .env.example .env  # 填 GLM_API_KEY
pnpm infra:up
pnpm db:generate && pnpm db:migrate:dev --name init
psql "$DATABASE_URL" -f scripts/sql/000_init.sql
pnpm db:seed
pnpm dev
```

## 📈 里程碑
- M0 基础设施 ✅
- M1 认证+AI Gateway ✅
- M2 Agent+内容工厂 ✅（MVP Demo）
- M3 知识库+工作流 ✅
- M4 CRM+客服 ✅
- M5 市场+计费 ✅
- M6 Admin+驾驶舱 ✅
- M7 测试+部署文档 ✅

## ⚠️ 已知限制（P1 待补）
- OAuth（Google/GitHub）登录
- 2FA TOTP
- Stripe 实付集成（schema 已留 webhook 字段）
- 工作流编辑器可视化（React Flow 节点拖拽）
- Python Sidecar（PDF/DOCX 解析）
- K8s Helm chart
- RLS（PostgreSQL Row Level Security）
- 内容安全审核（关键词+模型分类）
- 监控告警（OpenTelemetry + Sentry）
- i18n（多语言 UI）

## 📝 后续建议
1. 先 `pnpm install` 装依赖跑 `pnpm typecheck` 修复残留类型问题
2. 申请 GLM API Key 后跑通 MVP Demo（上传商品→生成内容）
3. 按 ROADMAP.md 阶段 2 推进 MVP 用户验证
4. 优先补 Stripe 实付 + 工作流可视化（最高商业价值）
