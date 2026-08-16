# 产品成熟度验收清单

MatrixFlow 当前的定位是“生产可用 Beta / 候选版”：核心数据边界、认证、权限、AI 运行时、异步执行和发布质量门禁已经具备。代码层面的成熟能力已落地，但真实 Provider、支付、告警、备份和企业合规仍必须在生产环境配置并留下证据后，才能升级为成熟商业产品。

## 已达到的生产基线

- Appwrite 单一后端边界，浏览器不持有服务端密钥。
- Team ID 作为租户边界，Function 统一执行成员、角色、字段和额度校验。
- 登录、邮箱验证、MFA、恢复代码、会话设备管理和账户恢复。
- 业务写入幂等、审计、限流、月度额度、资源上限和安全错误映射。
- Anthropic Messages 与 OpenAI Chat Completions / compatible 协议适配，具备超时、有限重试、响应上限、请求 ID 和用量记录。
- 自动 Provider 故障转移、端点 HTTPS/私网校验、模型与协议健康状态；未配置时安全失败。
- Agent、DAG 工作流、知识库解析/检索、运行重试、成本遥测和计费权益基础。
- 长任务可落到 Appwrite 持久化后台任务，支持 202 返回、状态查询、取消、心跳和有界重试。
- 组织数据导出、显式确认删除、敏感字段脱敏和审计/计费事件保留策略。
- 租户绑定的哈希 API Key、细粒度作用域、撤销、过期和 API 调用入口。
- 发票、支付、退款和拒付事件的规范化存储模型；供应商回调使用 HMAC 与事件幂等。
- 简体中文、繁體中文、English 三语，以及响应式移动端布局。
- GitHub CI、CodeQL、依赖安全审计、Vercel 生产构建和 Appwrite Schema 即代码。
- Chromium 浏览器 E2E 自动验证三语切换持久化、英文认证页和 390px 移动端无横向溢出。
- 生产公开面每小时由 GitHub Actions smoke 监测，首页安全响应头异常会直接告警。
- 主分支保护要求当前 CI 与 CodeQL 通过，并启用线性历史和会话解决。
- 生产运行的 SLO、告警、事件等级、发布证据与恢复演练标准已在 `docs/operations.md` 定义。

## 发布前必须配置

这些项目不能由代码凭空完成，需要运营方提供真实外部配置：

1. 在 Appwrite Function 中配置至少一个 AI Provider Secret，并建议同时配置 Anthropic 与 OpenAI-compatible 作为故障转移池；生产部署流水线会强制执行一次真实、低 token 的 Agent smoke，未配置或调用失败时发布不通过。
2. 配置短期 `MATRIXFLOW_DEPLOY_KEY` 或由已授权管理员在 Appwrite Console 发布 Function；发布后验证 active deployment。后端变更流水线在缺少该 Secret 时会显式失败，不会静默跳过。
3. 为异步任务配置 32 字符以上的 `MATRIXFLOW_WORKER_SECRET`，并确认 Function 具备 `executions.write` scope；没有该配置时异步入口会安全失败，不会伪装成已排队。
4. 如果启用付费，配置 Stripe Checkout 与 `/billing/stripe-webhook`（或接入其他供应商适配层），验证 checkout、invoice、payment、refund、chargeback、取消、欠费和恢复事件，并验证重复事件幂等。
5. 为生产域名配置监控、错误告警、备份保留和恢复演练记录；告警必须进入有人值守渠道。
6. 为外部邮件、Webhook、CRM 等连接器提供最小权限凭据、OAuth/凭据保险箱和出站域名白名单。
7. 使用专用管理员测试账号验证 API Key 创建、作用域隔离、撤销、过期、组织导出/删除和清理流程。

## 规模化阶段

- 大型知识库需要向量检索或托管搜索索引，而不是继续扩大单次 lexical 扫描。
- 长耗时工作流的持久化任务与 Appwrite 异步执行器已经具备；规模化阶段仍需要独立队列、死信队列、并发配额和跨区域 Worker。
- 企业客户需要 SSO/SAML、SCIM、审计导出、数据驻留和可配置保留周期。
- 商业化后仍需要真实支付供应商、税率计算、退款/拒付自动化、欠费催收、用量预警和完整自助账单门户。
- 高敏知识库需要文档级 ACL、向量检索、保留策略和检索质量评测。

## 验收命令

```bash
pnpm verify
pnpm function:check
pnpm function:test
pnpm test:e2e
pnpm audit --prod --audit-level=high
npm audit --omit=dev --prefix apps/functions/matrixflow-core
pnpm smoke:production
```

只有代码质量、生产页面、Function active deployment、真实 Provider 调用和外部运营配置全部有证据，才可以把产品称为“成熟版”；否则应明确标记为生产可用 Beta。
