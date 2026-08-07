# 安全实现状态

本文只描述仓库已落地的控制；未实现项不会以合规能力对外宣传。

## 已实现

- 生产认证固定为 Appwrite；本地 JWT 仅在 `AUTH_MODE=local` 或测试环境启用，并限制 issuer、audience 和 HS256。
- Refresh Token 原子轮换，数据库和 Redis 只保存 SHA-256 摘要；冻结、软删除和成员关系在鉴权上下文检查。
- 平台管理员仅接受 `PLATFORM_ADMIN_IDS` 中的用户 UUID，不接受可变邮箱白名单；组织 Owner 不等于平台管理员。
- CRM、内容、市场、RAG、AI 缓存和跨实体引用在服务层按组织隔离；写入请求使用严格 Zod Schema 防止越权字段注入。
- 认证入口采用独立且 fail-closed 的限流策略；普通请求按已验证用户或 IP 限流。
- 生产 CORS 白名单、所有环境启用 Helmet/CSP、frameguard、精确代理跳数和日志敏感 Header 脱敏。
- 上传限制格式、大小、魔数、PDF 页数、DOCX 解压资源、提取字符和分块数；删除文档同步删除对象与向量数据。
- Prompt 注入检测、结构化输出 Schema 校验、AI 超时/取消、组织限流和一致用量核算。
- Webhook 限制方法、HTTPS、响应大小和超时；拒绝私网/本地/元数据地址，禁用重定向，并把连接固定到已验证 DNS 地址。
- BullMQ 持久化重试、稳定 job ID 和数据库租约；内部任务端点使用常量时间共享密钥校验。
- MinIO bucket 默认私有，Sidecar 只暴露到内部容器网络；生产数据库只运行版本化 migration。
- Prometheus 指标端点使用独立长随机 Token；liveness 与依赖 readiness 分离。
- CI 使用最小权限和不可变 SHA 固定 Actions，运行依赖审计、CodeQL、分包覆盖率门禁、集成测试和全部容器构建；Dependabot 覆盖 npm、pip、Docker 和 Actions。

## 仍需外部或产品级控制

- Stripe Checkout/Webhook 签名、幂等事件、退款和订阅状态机。
- SMTP 邮件、人工审批持久化暂停/恢复、Schedule 和 Loop 资源上限。
- IntegrationAccount 启用前的 KMS/信封加密和正式密钥轮换流程。
- ClamAV 或云恶意文件扫描；当前只有格式与资源消耗防护。
- 数据导出/删除、保留策略、审计日志防篡改及正式隐私流程。
- PostgreSQL RLS 作为应用层租户过滤之外的纵深防御。
- 云平台网络策略、TLS 终止、WAF、集中日志告警、备份恢复演练和外部渗透测试。

不得在完成相应审计和组织流程前声称 PCI DSS、SOC 2、GDPR 认证或“绝对安全”。漏洞报告方式见仓库根目录 [SECURITY.md](../SECURITY.md)。
