# 安全状态

更新时间：2026-08-16。

## 已落地

- Appwrite Email/Password、Email OTP、Team Invites 和 JWT 已启用；匿名、Magic URL 与手机登录已关闭。
- 密码至少 8 位并要求大小写字母和数字；启用 5 次密码历史、字典与个人信息检查。
- 会话有效期 14 天、每用户最多 10 个会话，启用新会话提醒和改密后会话失效。
- 支持在设置中心启用 TOTP 双重验证；绑定必须先校验动态码，启用后可生成一次性恢复代码，登录页同时支持身份验证器和恢复代码挑战。
- Appwrite Team 是唯一租户边界；普通业务行和文件使用团队读取权限，审计、用量、账单与幂等记录改由 Function 专属读取，函数再次验证成员关系。
- 所有业务表关闭客户端创建权限；创建、更新、删除统一经过 Function 的角色检查与 Zod 字段白名单。
- 所有认证请求按组织和用户/API Key 执行原子分钟级限流；AI 调用另有每组织月度额度和分钟级速率限制，额度使用 Appwrite 原子计数器预留，避免并发请求穿透上限；关键写入与执行写入 `audit_logs`。
- 套餐升级申请只允许已验证团队成员提交，服务端限定套餐、席位和备注范围，同一组织同一套餐的待处理申请会去重，并写入 `audit_logs`。
- 套餐权益只由 Function 服务端读取 `subscriptions` 判定；计费适配器的 `/billing/webhook` 使用原始请求体 HMAC-SHA256 校验，并通过唯一 `billing_events.eventId` 幂等处理。
- Stripe 直连回调 `/billing/stripe-webhook` 使用时间戳容忍窗口和 `STRIPE_WEBHOOK_SECRET` 校验原始签名，再转换为内部 HMAC 事件，避免信任客户端传入的订阅状态。
- 计费状态覆盖试用、正常、逾期、暂停、取消和拒付；发票与支付/退款/拒付交易分别持久化，浏览器只读经过 Function 授权的摘要。
- API Key 以 SHA-256 哈希存储，前缀用于索引，完整密钥只在创建响应中出现一次；每个 Key 绑定组织、作用域、过期时间和撤销时间。
- API Key 请求必须同时提供 `Authorization: Bearer mf_live_...` 与 `X-MatrixFlow-Organization`；作用域不足会被 Function 拒绝，不能冒充 Appwrite 用户或跨租户读取。
- 长任务写入 `background_jobs`，由 Appwrite 内部异步执行调用；内部路径需要独立 `MATRIXFLOW_WORKER_SECRET`，任务使用条件更新原子领取、租约心跳、过期接管、取消和有界重试。
- Provider 端点必须使用 HTTPS，生产默认拒绝私网/本地地址、凭据、查询参数和片段；Webhook 仅允许出站白名单域名。
- 组织导出会对密钥、Token、密码、Cookie 和授权字段脱敏；删除操作要求精确输入组织 ID，安全审计、订阅、发票、交易和计费事件按保留策略留存。
- 浏览器只包含公开 endpoint/project ID；AI 密钥和部署 key 不进入客户端 bundle。
- 云函数限制请求体、Prompt、文档文本、DAG 大小、执行时间和错误信息长度。
- 文档解析仅接受 PDF、DOCX、TXT、Markdown、CSV；建立文档记录和开始索引前均会验证 Storage 文件的 Team 权限、大小和 MIME，删除记录时同步删除对应文件。
- AI Provider 未配置或不可用时失败关闭，不返回模拟内容。
- 变更请求默认携带幂等键；Function 通过唯一索引先原子占用、再执行业务、最后提交响应，按团队、方法、路径和请求指纹重放 24 小时内的成功响应，阻止并发网络重试造成重复写入。
- 知识文档索引拆分为受字节上限约束的 `knowledge_chunks` 行；版本化索引采用先写新版本、切换父行、再清理旧版本的流程，文档父行只保留预览文本。
- CI 执行格式、类型、lint、单测、生产构建、依赖审计；CodeQL 扫描 JavaScript/TypeScript。
- Web 设置 CSP、拒绝嵌入、内容类型保护、严格来源策略、权限策略和 HSTS；头像限制为内置资源或 Appwrite 托管地址。
- 公开 `healthz` 只返回服务存活状态，不泄露组织、Provider 或计费信息；带组织上下文的 `/health` 才返回受保护的运行就绪与套餐额度。

## 部署要求

- 部署用 API key 必须短期、最小权限并在部署后撤销。
- `ANTHROPIC_API_KEY` / `GLM_API_KEY` / `OPENAI_API_KEY` 只放在 Appwrite Function secret variables；端点、模型与协议选择也只由服务端变量控制。
- Anthropic 使用 `x-api-key` 与固定版本头，OpenAI-compatible 使用 Bearer 头；浏览器永远不会接触模型凭证。
- Provider 错误响应只返回稳定错误码，不回传原始响应体、请求头或密钥；429/5xx 仅做有界重试。
- 自动 Provider 故障转移只在配置池中的协议之间进行，凭证错误和参数错误不会盲目重试；健康接口只返回 Provider 名称、协议和模型，不返回密钥。
- 函数入口拒绝数组/null 请求体，限制请求体与列表扫描规模，且禁止通过更新接口改变资源所属团队；未知 Appwrite 异常只返回通用安全提示。
- 函数执行权限允许 API Key 客户端调用，但所有受保护路由必须通过 Appwrite 会话或作用域 API Key；公开路径仅限存活/就绪探针和签名计费 webhook。
- Appwrite Web Platform 只登记实际域名与本地开发主机。
- 生产变更前运行真实账户 smoke test，随后删除测试数据和测试会话。
- smoke test 必须验证浏览器等价会话不能直接创建业务行，而 Function 可以创建并由团队成员读取。
- GitHub、Vercel 和 Appwrite 的维护者账户应启用 MFA。

## 明确边界

- 邮件和任意 Webhook 连接器尚未配置，相关节点会返回 `CONNECTOR_NOT_CONFIGURED`。
- 连接器即使尚未启用也会先执行 URL、协议、私网地址和域名白名单校验；真正发送前仍需 OAuth/凭据保险箱和独立供应商审查。
- 关键词检索不是高敏感知识库的完整防泄漏方案；高敏场景需要文档级 ACL、审计导出和保留策略。
- 市场支付与公共发布尚未启用，不能把界面占位视为真实交易能力。
- `/billing/webhook` 是支付供应商适配边界，不等于已接入某一家支付平台；只有配置签名 Secret、规范化事件和供应商回调后才会改变订阅权益。
- Appwrite 托管层的备份、地域、DDoS、邮件投递和告警需在控制台/供应商侧单独治理。
- 组织删除不是跨表事务；代码返回逐表删除清单，生产运维必须保留删除请求、重试和审计事件证据。

漏洞请按根目录 [SECURITY.md](../SECURITY.md) 私下报告。
