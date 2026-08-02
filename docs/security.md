# MatrixFlow AI · 安全实现状态

本文只描述仓库中已经落地的控制。规划中但未实现的能力明确标记为待办。

## 已实现

- 生产认证源固定为 Appwrite；本地 JWT 仅在 `AUTH_MODE=local` 或测试环境启用。
- Appwrite 邮箱必须完成验证；用户、账户、默认组织、角色和权限初始化使用数据库事务与 advisory lock。
- Refresh Token 原子轮换并绑定原组织，数据库和 Redis 只保存 SHA-256 摘要。
- 用户冻结、组织冻结、软删除和租户成员关系均在鉴权上下文中检查。
- AI 缓存、业务查询、RAG 检索和组织路径参数按租户隔离。
- 平台管理员使用显式用户 ID/邮箱白名单，组织 Owner 不等于平台管理员。
- 全局 IP 限流、AI 组织限流、生产 CORS 白名单、Helmet/CSP/frameguard 和精确反向代理跳数配置。
- 用户、OAuth、Session、集成账户的敏感字段通过 Prisma 全局 omit 防止意外返回。
- 上传限制为 PDF、DOCX、TXT、Markdown、CSV；包含大小、魔数、PDF 页数、DOCX 解压大小、提取字符数和分块数限制。
- MinIO bucket 默认私有，Python Sidecar 仅暴露到容器网络。
- RAG 查询同时限制 organization、knowledge base 与未删除文档。
- 高置信提示注入检测和 Prompt 输出 JSON Schema 子集验证。
- 工作流 Webhook 只允许受控方法，生产只允许 HTTPS，拒绝本地/私网/元数据地址、重定向和超大响应。
- 文档和工作流任务通过 BullMQ 持久化、重试并使用数据库租约防止重叠执行；内部执行端点使用常量时间共享密钥校验。
- 生产数据库启动只运行版本化 `prisma migrate deploy`，不使用 `db push --accept-data-loss`。
- PostgreSQL、Redis、MinIO readiness 为真实依赖检查；liveness 与 readiness 分离。
- 收费能力未接 Stripe 时返回 HTTP 402，不创建虚假的已支付记录。

## 上线前仍需完成

- Stripe Checkout、Webhook 签名、幂等事件表、退款和订阅状态机。
- SMTP 邮件适配器、人工审批的持久化暂停/恢复状态、循环节点的迭代/资源上限。
- IntegrationAccount 真正启用前接入 KMS/信封加密；当前这些字段没有业务写入口。
- ClamAV 或云端恶意文件扫描；当前只有格式和资源消耗防护。
- 数据导出/删除、保留策略、审计日志防篡改以及正式隐私/合规流程。
- PostgreSQL RLS 作为应用层租户过滤之外的第二道防线。
- 外部渗透测试、威胁建模复核、备份恢复演练和密钥轮换演练。

不得在完成上述对应控制前使用“PCI、SOC 2、企业级合规”等声明。
