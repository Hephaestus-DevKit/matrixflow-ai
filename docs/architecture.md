# MatrixFlow AI 架构说明

## 设计原则

1. 业务能力按领域模块归属，避免跨目录复制查询和鉴权逻辑。
2. HTTP、队列和 Python Sidecar 只负责适配；核心校验与业务状态保留在 API 或独立 package。
3. 租户 ID 只能来自已验证认证上下文，不能信任客户端任意 Header 或路径参数。
4. 长任务通过 BullMQ 执行，数据库记录是可观察状态的唯一事实来源。
5. 数据结构只能通过版本化 Prisma migration 演进。

## Workspace 职责

| 路径 | 职责 | 不应包含 |
|---|---|---|
| `apps/web` | 页面、交互状态、API/Appwrite 客户端 | 数据库或服务端密钥 |
| `apps/api` | HTTP、认证授权、业务编排、持久化 | 长时间阻塞任务循环 |
| `apps/worker` | BullMQ 消费、重试、调用内部任务 API | 重复业务规则或直接伪造状态 |
| `apps/sidecar` | 受限文档解析与分块 | 租户授权、数据库访问、Embedding |
| `packages/shared` | 跨端常量、Zod Schema、DTO | NestJS/Next.js 运行时依赖 |
| `packages/db` | Prisma Schema、Client、migration、seed | HTTP 业务逻辑 |
| `packages/ai-gateway` | Provider、重试、流式协议、Prompt | 组织计费和数据库查询 |
| `packages/workflow-engine` | DAG 校验与通用执行协议 | NestJS、Prisma、Webhook 网络策略 |
| `packages/ui` | 可复用展示组件 | 页面级数据请求 |

## API 模块约定

每个领域目录通常包含：

```text
feature/
├─ feature.controller.ts   HTTP 输入、装饰器和状态码
├─ feature.service.ts      租户过滤、事务和业务编排
└─ feature.module.ts       NestJS 依赖注册与公开边界
```

通用能力放入 `apps/api/src/common`；数据库、Redis、对象存储和队列分别位于独立 infrastructure 模块。`common/auth-context.ts` 是请求用户类型和权限元数据的唯一来源。

## 同步请求链路

```text
Web / API client
  → RateLimitGuard
  → JwtAuthGuard（验证 Appwrite/本地令牌与组织成员关系）
  → RequireAction 权限检查
  → Controller
  → Service（始终携带 organizationId 查询）
  → Prisma / Redis / AI Gateway / MinIO
```

生产环境使用 Appwrite。`AUTH_MODE=local` 仅用于显式本地开发和测试。

## 异步任务链路

```text
API 创建 PENDING 记录
  → QueueService 写入 BullMQ
  → Worker 消费并携带内部共享密钥回调 API
  → InternalJobGuard 常量时间验证
  → Service 原子抢占数据库租约
  → 执行业务并写入 SUCCESS / FAILED 与日志
```

BullMQ 的 `jobId` 防止重复入队；数据库租约防止超时重试造成重叠执行。新增任务时必须同时定义队列数据类型、内部端点、幂等策略和失败状态。

## Sidecar 分层

- `main.py`：FastAPI 路由、输入上限和响应协议。
- `config.py`：资源限制环境变量。
- `parsers.py`：PDF/DOCX 安全解析。
- `text_processing.py`：纯文本清理与分块，可独立单测。

Sidecar 不可信任文件名或 MIME 类型作为唯一判断，API 和 Sidecar 两层均实施大小与格式限制。

## 增加功能的检查清单

1. 在对应领域建立或扩展 controller/service/module。
2. 为所有组织数据查询加入 `organizationId` 条件。
3. 将请求 Schema 放入 `packages/shared`，避免前后端重复定义。
4. 数据库变化新增 migration，并执行 `prisma validate`。
5. 外部网络调用设置超时、大小上限和错误映射。
6. 为权限、并发、失败重试和租户隔离补测试。
7. 更新 `.env.example`、README 或生产就绪文档。
