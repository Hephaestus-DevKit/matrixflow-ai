# Appwrite 原生架构

## 设计目标

MatrixFlow 采用单一云后端边界：Appwrite 负责身份、团队、业务数据、文件和受保护计算。浏览器不持有服务端密钥，云函数不信任浏览器传入的用户或组织身份。

## 组件职责

| 目录                             | 职责                                                                    | 不负责                       |
| -------------------------------- | ----------------------------------------------------------------------- | ---------------------------- |
| `apps/web`                       | 页面、交互、会话状态、类型化数据适配                                    | 保存服务端密钥、绕过团队权限 |
| `apps/web/src/lib/backend`       | 权限过滤读取、文件上传与函数调用适配                                    | 业务表写入、AI Provider      |
| `apps/functions/matrixflow-core` | 全部业务写入、RBAC、审计、AI、RAG、工作流、异步任务、API Key 和数据治理 | 页面渲染、长期保存部署密钥   |
| `packages/shared`                | 页面使用的 DTO、Zod 输入和工作流 DSL                                    | Appwrite 管理凭据、网络调用  |
| `infra/appwrite`                 | 数据表、索引、桶、函数声明                                              | 业务运行时状态               |

## 身份与租户

1. 浏览器通过 Appwrite Account 建立安全会话。
2. Appwrite Team ID 同时作为 MatrixFlow 的 `organizationId`。
3. 数据表关闭浏览器级创建权限；函数创建行时写入 `organizationId` 和团队行权限。
4. 文件使用相同团队权限；Function 在建立知识库记录和索引前再次校验 Storage 文件的团队权限、大小与 MIME，知识库记录只保存 Appwrite file ID。
5. 浏览器请求从 Appwrite 注入的 `x-appwrite-user-id` 识别调用者，并通过 Teams API 再次校验成员关系；自动化请求使用组织绑定的作用域 API Key，不伪造 Appwrite 用户。

组织切换会清空 React Query 缓存，避免界面展示上一组织的残留数据。

## 请求链路

权限过滤读取：

```text
Page → apiClient → backend/router → organization context
     → TablesDB → team permission-filtered result
```

业务写入与受保护计算：

```text
Page → apiClient → Appwrite Function execution
     → membership + role → Zod allowlist → atomic quota/rate reservation
     → team-scoped row + audit/usage/run record
```

## 工作流内核

- 最多 100 个节点、300 条连接，节点 ID 和类型有白名单。
- 拓扑排序拒绝循环依赖、自连接和悬空引用。
- 条件值经过显式类型转换，`false`、`0` 不会被当作非空字符串处理。
- true/false 出边会真实控制后续节点；未激活节点记为 `SKIPPED`。
- Agent/工作流运行写入开始与完成时间、Token、成本和重试关系；只有 `FAILED`/`COMPLETED` 运行允许通过团队隔离的 retry 路由重放，最多保留 10 层重试链。
- AI 调用有输入长度、512 KB 响应上限、5–60 秒可配置 Provider 超时、最多两次有界重试、月度额度和分钟级速率限制。协议适配层分别处理 Anthropic Messages 与 OpenAI Chat Completions，并统一返回文本、停止原因、token 用量、耗时和上游请求 ID。
- Provider 池支持自动故障转移；生产端点必须是 HTTPS，默认拒绝本地/私网地址。凭证错误和参数错误不会盲目转移，避免放大费用或掩盖配置问题。
- Agent、工作流、批量内容和知识索引可写入 `background_jobs`，由 Appwrite `createExecution(async=true)` 驱动，任务状态通过 Function 查询，支持取消、心跳和最多 10 次有界重试。
- 函数入口只接受 JSON 对象并限制 128 KB 请求体；列表读取最多扫描 10,000 行；资源的组织归属在更新时不可变。未知 Appwrite 异常统一转换为安全错误，避免把供应商内部细节回传到客户端。
- 邮件与 Webhook 在安全连接器配置前明确失败。

## 数据与索引

数据库 `matrixflow` 当前包含 29 张表，定义位于 `infra/appwrite/tables.json`；`workflow_versions` 保存不可变的流程版本，`knowledge_chunks` 通过索引版本进行无中断切换，`idempotency_keys` 通过原子占用防止并发网络重试造成重复写入，`background_jobs` 使用原子租约保存异步任务状态，`usage_counters` 通过数据库原子增量阻止并发配额穿透，`usage_aggregates` 将月度 Token、成本、Provider 和模型维度聚合，避免账单查询随原始用量行数线性失控，`api_keys` 只保存 API Key 哈希，`subscriptions`、`billing_events`、`billing_invoices` 与 `billing_transactions` 保存服务端权益和可审计的幂等计费证据。常用组织、状态、关联与月度用量字段均建立索引。文件桶 `knowledge-files` 限制允许的文档扩展名和大小。

Appwrite 声明是资源基线；运行时写入的数据不进入 Git。表结构变更必须同时更新声明、初始化脚本、共享契约和回归测试，并保持向后兼容的扩展顺序。

## 扩展规则

- 新增普通业务实体：先定义服务端创建权限、行权限和索引，再扩展 Function 路由与前端只读映射。
- 新增特权能力：放入云函数，先校验成员，再解析输入。
- 新增外部 Provider：服务端变量注入、协议适配、明确超时、有限重试、响应上限、错误映射和失败关闭；必须补充请求头、响应结构、用量和凭证错误的回归测试。
- 新增支付供应商：先在适配层将供应商事件规范化为 billing webhook schema，再以原始请求体 HMAC 签名调用 `/billing/webhook`；事件 ID 必须幂等，订阅权益只能由 Function 读取和更新。
- 公开市场内容需要独立审核和 public-read 发布流程；当前默认是组织私有数据。
