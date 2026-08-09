# MatrixFlow AI 架构

## 设计边界

1. 业务能力按领域模块归属，避免复制鉴权、租户查询和状态转换逻辑。
2. Controller 负责协议与输入，Service 负责租户过滤、事务和业务编排。
3. HTTP、队列和 Python Sidecar 是适配层；数据库记录是异步状态的事实来源。
4. 共享输入 Schema、响应 DTO 与工作流 DSL 位于 `packages/shared`，框架无关执行核心位于独立 package。
5. 数据结构仅通过版本化 Prisma migration 演进。
6. 支付、邮件等外部系统通过领域端口与适配器接入；未配置实现必须明确失败。

## Workspace 职责

| 路径                       | 职责                                   | 禁止放入                     |
| -------------------------- | -------------------------------------- | ---------------------------- |
| `apps/web`                 | 页面、交互状态、API/Appwrite 客户端    | 数据库访问、服务端密钥       |
| `apps/api`                 | HTTP、认证授权、业务编排、持久化       | 长时间后台循环               |
| `apps/worker`              | BullMQ 消费、重试、内部任务回调        | 重复业务规则、伪造状态       |
| `apps/sidecar`             | 受限文档解析与分块                     | 租户授权、数据库、Embedding  |
| `packages/shared`          | 常量、Zod Schema、跨端类型             | NestJS/Next.js 运行时耦合    |
| `packages/db`              | Prisma Schema、Client、migration、seed | HTTP 业务逻辑                |
| `packages/ai-gateway`      | Provider、超时、fallback、流协议       | 组织计费、数据库查询         |
| `packages/workflow-engine` | DAG 校验与通用执行协议                 | NestJS、Prisma、网络安全策略 |

## API 请求链路

```text
Web / API client
  → JwtAuthGuard（公开路由跳过）
  → RateLimitGuard（可使用已验证 userId，并对认证入口 fail closed）
  → RequireAction 权限检查
  → Controller + shared Zod schema
  → Service（organizationId 过滤、事务、审计）
  → Prisma / Redis / AI Gateway / MinIO
```

生产使用 Appwrite。`AUTH_MODE=local` 只用于显式开发和测试。平台管理员由不可变用户 UUID 白名单识别，组织 Owner 不自动获得平台权限。

## 异步任务链路

```text
API 创建 PENDING 记录
  → QueueService 写入 BullMQ（稳定 jobId）
  → Worker 携带内部共享密钥调用 API
  → InternalJobGuard 常量时间校验
  → Service 原子抢占数据库租约
  → 执行并写入 SUCCESS / FAILED 与日志
```

新增任务必须同时定义队列数据类型、内部端点、幂等键、执行租约和失败状态。Worker 不直接绕过 API 修改受保护业务状态。

## AI 与 RAG

- AI Gateway 将聊天模型和 Embedding 模型分别映射到 Provider，fallback 不复用错误模型名。
- Provider 只重试网络错误、429 和可恢复的 5xx；永久 4xx 不做无效重试。客户端取消立即停止 fallback；流式响应一旦向调用方发出内容，失败就原样上抛，避免用完整响应覆盖后造成内容重复。
- API 负责 Prompt 注入检测、输出 Schema 校验、缓存键、组织限流和用量记账。
- 流式请求支持客户端断开取消；只有完成后的流才进行结构化输出校验和用量写入。
- 文档由 Sidecar 安全解析，API 批量创建分块并以有界并发生成 Embedding。
- 检索同时限制组织、知识库、未删除文档和相似度阈值。

## Web 应用壳

- `DashboardShell` 统一管理桌面侧栏、移动抽屉、顶部栏、内容宽度与路由过渡；导航元数据只维护在 `dashboard-navigation.ts`。
- 页面标题、指标卡、加载、错误和空状态由 `components/ui` 的无业务组件提供，领域页面只组合查询和业务内容。
- API Client 对并发 JWT 刷新做请求合并，并按 HTTP 状态控制 React Query 重试；组织切换时清空查询缓存，禁止短暂显示上一组织的数据。
- 页面提供跳转主内容入口、语义化导航、键盘焦点、减少动画偏好和 320px 起的响应式布局。新增页面必须同时验证桌面与移动断点。

## 工作流与 Webhook

`packages/shared` 是节点、边、条件语义和负载上限的唯一契约来源；`packages/workflow-engine` 负责 DAG 验证、条件分支路由、拓扑执行和节点协议；API 注入 AI、转换、邮件与 Webhook handler。Webhook 在请求前解析 DNS，只接受公网地址，并让 HTTP dispatcher 连接到已验证地址，以消除解析检查和实际连接之间的 DNS rebinding 窗口；同时禁用重定向并限制超时和响应体。

## 外部集成端口

支付结账和邮件投递分别由 Billing、Workflow 领域定义接口，Nest Module 只负责绑定具体适配器。仓库默认绑定禁用适配器：付费结账返回 HTTP 402，邮件节点返回未实现错误。接入 Stripe、SMTP 或第三方邮件服务时，应新增 adapter，而不是把供应商 SDK、Webhook 状态机或凭据处理写入领域 Service。

## Sidecar 分层

- `main.py`：FastAPI 路由、输入上限和响应协议。
- `config.py`：资源限制环境变量。
- `parsers.py`：PDF/DOCX 安全解析。
- `text_processing.py`：纯文本清理与分块，可独立测试。

API 和 Sidecar 均限制文件大小与格式；Sidecar 不信任文件名或 MIME 类型作为唯一判断。

## 扩展检查清单

1. 在对应领域扩展 controller/service/module，并定义最小公开边界。
2. 所有组织数据查询加入 `organizationId`，跨实体引用再次验证所属组织。
3. 请求 Schema 放入 `packages/shared`，严格拒绝未知字段和越界负载。
4. 数据库变化新增 migration，执行 `prisma validate`、生成 Client 并补回归测试。
5. 外部调用设置取消、超时、响应上限和安全错误映射。
6. 为权限、并发、失败重试、租户隔离和不可信输入补测试。
7. 更新 `.env.example`、README、生产部署和安全文档。
8. 跨 API/Web/Engine 的结构先进入 `packages/shared`，禁止在消费端复制漂移的接口。
