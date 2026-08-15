# 安全状态

更新时间：2026-08-16。

## 已落地

- Appwrite Email/Password、Email OTP、Team Invites 和 JWT 已启用；匿名、Magic URL 与手机登录已关闭。
- 密码至少 8 位并要求大小写字母和数字；启用 5 次密码历史、字典与个人信息检查。
- 会话有效期 14 天、每用户最多 10 个会话，启用新会话提醒和改密后会话失效。
- 支持在设置中心启用 TOTP 双重验证；绑定必须先校验动态码，启用后可生成一次性恢复代码，登录页同时支持身份验证器和恢复代码挑战。
- Appwrite Team 是唯一租户边界；普通业务行和文件使用团队读取权限，审计、用量、账单与幂等记录改由 Function 专属读取，函数再次验证成员关系。
- 所有业务表关闭客户端创建权限；创建、更新、删除统一经过 Function 的角色检查与 Zod 字段白名单。
- AI 调用执行每组织月度额度和分钟级速率限制；关键写入与执行写入 `audit_logs`。
- 套餐升级申请只允许已验证团队成员提交，服务端限定套餐、席位和备注范围，同一组织同一套餐的待处理申请会去重，并写入 `audit_logs`。
- 浏览器只包含公开 endpoint/project ID；AI 密钥和部署 key 不进入客户端 bundle。
- 云函数限制请求体、Prompt、文档文本、DAG 大小、执行时间和错误信息长度。
- 文档解析仅接受 PDF、DOCX、TXT、Markdown、CSV；删除记录时同步删除对应文件。
- AI Provider 未配置或不可用时失败关闭，不返回模拟内容。
- 变更请求默认携带幂等键；Function 按团队、方法、路径和请求指纹重放 24 小时内的成功响应，降低网络重试导致的重复写入。
- 知识文档索引拆分为受字节上限约束的 `knowledge_chunks` 行，文档父行只保留预览文本。
- CI 执行格式、类型、lint、单测、生产构建、依赖审计；CodeQL 扫描 JavaScript/TypeScript。
- Web 设置 CSP、拒绝嵌入、内容类型保护、严格来源策略、权限策略和 HSTS；头像限制为内置资源或 Appwrite 托管地址。

## 部署要求

- 部署用 API key 必须短期、最小权限并在部署后撤销。
- `ANTHROPIC_API_KEY` / `GLM_API_KEY` / `OPENAI_API_KEY` 只放在 Appwrite Function secret variables；端点、模型与协议选择也只由服务端变量控制。
- Anthropic 使用 `x-api-key` 与固定版本头，OpenAI-compatible 使用 Bearer 头；浏览器永远不会接触模型凭证。
- Provider 错误响应只返回稳定错误码，不回传原始响应体、请求头或密钥；429/5xx 仅做有界重试。
- 函数入口拒绝数组/null 请求体，限制请求体与列表扫描规模，且禁止通过更新接口改变资源所属团队；未知 Appwrite 异常只返回通用安全提示。
- Appwrite Web Platform 只登记实际域名与本地开发主机。
- 生产变更前运行真实账户 smoke test，随后删除测试数据和测试会话。
- smoke test 必须验证浏览器等价会话不能直接创建业务行，而 Function 可以创建并由团队成员读取。
- GitHub、Vercel 和 Appwrite 的维护者账户应启用 MFA。

## 明确边界

- 邮件和任意 Webhook 连接器尚未配置，相关节点会返回 `CONNECTOR_NOT_CONFIGURED`。
- 关键词检索不是高敏感知识库的完整防泄漏方案；高敏场景需要文档级 ACL、审计导出和保留策略。
- 市场支付与公共发布尚未启用，不能把界面占位视为真实交易能力。
- Appwrite 托管层的备份、地域、DDoS、邮件投递和告警需在控制台/供应商侧单独治理。

漏洞请按根目录 [SECURITY.md](../SECURITY.md) 私下报告。
