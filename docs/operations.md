# 生产运行与可靠性基线

本文件定义 MatrixFlow 从“生产可用 Beta”进入“成熟产品”必须持续满足的运行标准。目标值不是完成证明；只有监控、告警、演练和记录同时存在，才视为达标。

## 服务目标

| 指标                              | 成熟版目标 | 验证方式                                           |
| --------------------------------- | ---------: | -------------------------------------------------- |
| 公开页面月可用性                  |    ≥ 99.9% | 每小时生产 smoke 与 Vercel 可用性记录              |
| Appwrite Function 月可用性        |    ≥ 99.9% | 认证后的 `/health` 与真实 Provider smoke           |
| 普通 CRUD 请求 p95                |     ≤ 3 秒 | Function 结构化日志和平台指标                      |
| AI 请求成功率（排除用户输入错误） |      ≥ 99% | `agent_runs`、`workflow_runs` 与 Provider 错误分类 |
| AI 同步请求 p95                   |    ≤ 60 秒 | 运行记录 `durationMs`；超过上限转后台任务          |
| 后台任务排队等待 p95              |    ≤ 30 秒 | `background_jobs.runAfter` 与创建时间差            |
| 后台任务最终成功率                |      ≥ 99% | `background_jobs` 按类型、重试次数和错误码统计     |
| 数据恢复点 RPO                    |  ≤ 24 小时 | Appwrite 备份策略和最近一次备份证据                |
| 数据恢复时间 RTO                  |   ≤ 4 小时 | 至少每季度一次恢复演练记录                         |

## 必须告警

- 生产公开 smoke 连续两次失败，或安全响应头、canonical、三语服务端首屏语言/标题/主体标记异常。
- Function 5xx 比例 5 分钟内超过 2%，或 p95 延迟连续 10 分钟超标。
- Anthropic/OpenAI-compatible Provider 连续失败、429 激增、凭据无效或预算接近上限。
- Appwrite 数据库、Storage、Functions 或认证服务不可用。
- 月度 AI 用量达到 80%/95%/100%，以及异常成本增长。
- 后台任务积压、`RETRY_WAIT` 超过 5 分钟、取消请求未收敛或重试耗尽。
- API Key 大量失败、单一 Key 异常调用、即将过期和权限作用域冲突。
- 计费 webhook 签名失败、事件重复率异常、发票支付失败、退款或拒付事件未落库。
- 发布后真实 Provider smoke、租户隔离检查或测试数据清理失败。

告警必须进入有人值守的渠道，并包含环境、commit、deployment ID、request ID、错误分类和回滚入口；不能只依赖控制台里无人查看的日志。

严格发布审计还要求 `MATRIXFLOW_ALERT_WEBHOOK_URL` 使用 HTTPS；`MATRIXFLOW_BACKUP_EVIDENCE_URL` 与
`MATRIXFLOW_BACKUP_LAST_SUCCESS_AT` 必须证明最近 26 小时内有成功备份；
`MATRIXFLOW_RESTORE_EVIDENCE_URL` 与 `MATRIXFLOW_RESTORE_LAST_SUCCESS_AT` 必须证明最近 92 天内完成过隔离恢复演练。

## 事件等级

| 等级  | 示例                                   | 首次响应目标 | 处理要求                                 |
| ----- | -------------------------------------- | -----------: | ---------------------------------------- |
| SEV-1 | 跨租户数据泄露、认证绕过、全站不可用   |      15 分钟 | 立即阻断、轮换凭据、保全证据并通知负责人 |
| SEV-2 | 核心 AI/工作流大面积失败、数据写入异常 |      30 分钟 | 停止发布、回滚或降级并持续更新状态       |
| SEV-3 | 局部功能故障、性能下降、有替代路径     |       4 小时 | 记录影响范围、修复计划和回归证据         |

事件结束后 3 个工作日内完成无责复盘，记录根因、时间线、用户影响、修复、长期预防项与负责人。

## 发布证据

每次生产发布至少保留：

1. Git commit 与通过保护规则合并的 PR；
2. CI、CodeQL、依赖审计和 Vercel deployment 成功记录；
3. Appwrite active deployment ID，且与本次发布源码一致；
4. Schema 变更结果与向后兼容说明；
5. 真实账户 smoke：认证、团队隔离、浏览器禁写、Function 写入、真实 Provider 调用和清理；
6. 生产公开 smoke、Chromium 浏览器 E2E，以及关键登录后路径的人工或自动化验收；
7. 明确的上一版本回滚点。
8. 后台任务队列深度、Provider 故障转移结果和计费事件处理摘要。

## 备份与恢复

- 明确数据库和 Storage 的保留周期、加密、访问权限与跨故障域策略。
- 每季度从备份恢复到隔离环境，核对租户边界、行数、文件可读性和关键业务关系。
- 恢复演练不得连接真实 Provider、邮件、Webhook 或支付回调，避免产生外部副作用。
- 任何破坏性 Schema 变更必须先完成备份、恢复验证和独立审批。
- `background_jobs`、`billing_events`、`billing_invoices` 和 `billing_transactions` 必须纳入备份；恢复后先在隔离环境暂停异步执行器。
- API Key 只保留哈希；恢复演练不得导出或重新显示完整密钥。

## 当前边界

代码已经提供结构化 request ID、运行耗时、用量/成本记录、Provider 故障转移、后台任务状态、原子任务租约与心跳、API Key 作用域、每小时公开 smoke、发布 smoke 和回滚手册。后台任务通过 Appwrite `updateRows` 的状态谓词领取；重复投递只会由一个 Worker 获得租约，过期租约才允许接管。外部告警渠道、Appwrite 备份策略、真实 Provider 凭据、支付与连接器凭据仍需由生产环境管理员配置并留下证据；严格审计会校验证据的新鲜度，在这些证据齐全前，产品应继续标记为“生产可用 Beta”。
