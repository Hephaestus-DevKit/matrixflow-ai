# 安全状态

更新时间：2026-08-11。

## 已落地

- Appwrite Email/Password、Email OTP、Team Invites 和 JWT 已启用；匿名、Magic URL 与手机登录已关闭。
- 密码至少 8 位并要求大小写字母和数字；启用 5 次密码历史、字典与个人信息检查。
- 会话有效期 14 天、每用户最多 10 个会话，启用新会话提醒和改密后会话失效。
- Appwrite Team 是唯一租户边界；业务行和文件使用团队权限，函数再次验证成员关系。
- 浏览器只包含公开 endpoint/project ID；AI 密钥和部署 key 不进入客户端 bundle。
- 云函数限制请求体、Prompt、文档文本、DAG 大小、执行时间和错误信息长度。
- 文档解析仅接受 PDF、DOCX、TXT、Markdown、CSV；删除记录时同步删除对应文件。
- AI Provider 未配置或不可用时失败关闭，不返回模拟内容。
- CI 执行格式、类型、lint、单测、生产构建、依赖审计；CodeQL 扫描 JavaScript/TypeScript。

## 部署要求

- 部署用 API key 必须短期、最小权限并在部署后撤销。
- `GLM_API_KEY` / `OPENAI_API_KEY` 只放在 Appwrite Function secret variables。
- Appwrite Web Platform 只登记实际域名与本地开发主机。
- 生产变更前运行真实账户 smoke test，随后删除测试数据和测试会话。
- GitHub、Vercel 和 Appwrite 的维护者账户应启用 MFA。

## 明确边界

- 邮件和任意 Webhook 连接器尚未配置，相关节点会返回 `CONNECTOR_NOT_CONFIGURED`。
- 关键词检索不是高敏感知识库的完整防泄漏方案；高敏场景需要文档级 ACL、审计导出和保留策略。
- 市场支付与公共发布尚未启用，不能把界面占位视为真实交易能力。
- Appwrite 托管层的备份、地域、DDoS、邮件投递和告警需在控制台/供应商侧单独治理。

漏洞请按根目录 [SECURITY.md](../SECURITY.md) 私下报告。
