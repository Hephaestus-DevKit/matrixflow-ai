# 产品成熟度验收清单

MatrixFlow 当前的定位是“生产可用 Beta / 候选版”：核心数据边界、认证、权限、AI 运行时和发布质量门禁已经具备，但外部商业与运营系统仍需要配置后才算完整成熟产品。

## 已达到的生产基线

- Appwrite 单一后端边界，浏览器不持有服务端密钥。
- Team ID 作为租户边界，Function 统一执行成员、角色、字段和额度校验。
- 登录、邮箱验证、MFA、恢复代码、会话设备管理和账户恢复。
- 业务写入幂等、审计、限流、月度额度、资源上限和安全错误映射。
- Anthropic Messages 与 OpenAI Chat Completions / compatible 协议适配，具备超时、有限重试、响应上限、请求 ID 和用量记录。
- Agent、DAG 工作流、知识库解析/检索、运行重试、成本遥测和计费权益基础。
- 简体中文、繁體中文、English 三语，以及响应式移动端布局。
- GitHub CI、CodeQL、依赖安全审计、Vercel 生产构建和 Appwrite Schema 即代码。

## 发布前必须配置

这些项目不能由代码凭空完成，需要运营方提供真实外部配置：

1. 在 Appwrite Function 中配置至少一个 AI Provider Secret，并用真实模型执行一次端到端 smoke test。
2. 配置短期 `MATRIXFLOW_DEPLOY_KEY` 或由已授权管理员在 Appwrite Console 发布 Function；发布后验证 active deployment。
3. 如果启用付费，接入真实支付供应商，将供应商事件规范化后以 HMAC 调用 `/billing/webhook`，并测试重复事件、取消、欠费和恢复。
4. 为生产域名配置监控、错误告警、备份保留和恢复演练记录。
5. 为外部邮件、Webhook、CRM 等连接器提供最小权限凭据和出站域名白名单。

## 规模化阶段

- 大型知识库需要向量检索或托管搜索索引，而不是继续扩大单次 lexical 扫描。
- 长耗时工作流需要队列/后台执行器、取消任务和可观测状态，而不是依赖单次同步请求。
- 企业客户需要 SSO/SAML、SCIM、审计导出、数据驻留和可配置保留周期。
- 商业化后需要发票、税率、退款、欠费催收、用量预警和自助账单门户。

## 验收命令

```bash
pnpm verify
pnpm function:check
pnpm function:test
pnpm audit --prod --audit-level=high
npm audit --omit=dev --prefix apps/functions/matrixflow-core
pnpm smoke:production
```

只有代码质量、生产页面、Function active deployment、真实 Provider 调用和外部运营配置全部有证据，才可以把产品称为“成熟版”；否则应明确标记为生产可用 Beta。
