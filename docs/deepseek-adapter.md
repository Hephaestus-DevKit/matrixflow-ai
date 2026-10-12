# DeepSeek Flash 适配

2026-10-10：生产 Provider 使用 `deepseek`，模型使用官网当前推荐的 `deepseek-flash`（DeepSeek-V4.1-Flash）。模型名依据 [官网模型与价格表](https://api-docs.deepseek.com/quick_start/pricing/)，采用稳定别名，后续模型版本与价格仍以供应商公布信息为准。

## 协议与参数

本项目参考 [DeepSeek 官方 Harness 的 Messages 适配](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/llm/llm-deepseek/src/adapter.ts) 与 [请求序列化](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/llm/llm-deepseek/src/serialize.ts)，使用 `https://api.deepseek.com/anthropic/v1/messages`。这是 DeepSeek 官方支持的 Anthropic-compatible Messages API，Provider 名仍为 DeepSeek；原生 Anthropic 与 OpenAI-compatible 适配继续保留。

- `DEEPSEEK_API_KEY`：仅存 Appwrite Function Secret，不向浏览器返回。
- `DEEPSEEK_MODEL=deepseek-flash`。
- `DEEPSEEK_BASE_URL=https://api.deepseek.com/anthropic`：接受带 `/v1` 或完整 `/v1/messages` 的规范端点，不重复拼接路径。
- `DEEPSEEK_REASONING_EFFORT=none`：默认发送 `thinking.type=disabled`，满足日常运营任务的速度偏好；`low`、`high`、`max` 可发送 `thinking.type=enabled` 与 `output_config.effort`。
- 使用 `x-api-key`、`max_tokens` 和既有有界超时/重试。非思考模式省略无效的 top-p；思考模式按供应商约束将其限制到 0.95–1.0。

参数依据 [官方 Anthropic API 兼容表](https://api-docs.deepseek.com/guides/anthropic_api/) 和 [思考模式说明](https://api-docs.deepseek.com/guides/thinking_mode/)。本项目只发送当前功能需要的文本请求，不复制 Harness 的插件清单、会话日志或工具扩展字段。

## 用量、隔离与错误

Messages 输入用量按未缓存输入、缓存读取和缓存写入之和记录，单独保留缓存计数；输出只提取 text 内容，不把 thinking 内容当作业务回复。用量记录与内容元数据保留缓存计数，不修改 Appwrite 表结构。

租户 ID 只经过 SHA-256 转换后作为 `metadata.user_id` 发送，保持同一租户的缓存/调度隔离标识稳定，不发送原始 Team ID 或用户个人信息。依据 [官方限流与隔离文档](https://api-docs.deepseek.com/quick_start/rate_limit/)，这只是供应商请求隔离提示；业务访问控制仍由 MatrixFlow 的 Appwrite 团队权限执行。

HTTP 402 显示余额不足；401/403、400 等返回稳定错误，且不重试这类错误。响应不是 JSON 时仍按 HTTP 错误状态分类。禁止请求重定向，避免密钥或请求内容被带到其他端点。

成本继续使用运营方提供的 `MATRIXFLOW_AI_PRICING_JSON`。可为 `deepseek:deepseek-flash` 配置 `inputPer1k`、`cachedInputPer1k`、`outputPer1k`；缓存 Token 不会重复按未缓存价格计算。没有价格配置时估算仍为 0。官网费率存在峰谷时段差异，本轮未将费率硬编码为永久准确的账单金额。

## 迁移与验证

旧的 `deepseek-v4-flash`、`deepseek-v4-flash-vision-exp` 及原网关的 `deepseek-v4-flash-0731` 转为 `deepseek-flash`。新建 AI 员工不再由共享 Schema 注入 GLM 默认模型，而是使用服务端配置的 Provider 模型；显式选择的模型继续保留。

本地 `pnpm verify` 通过：共享包 12、前端 20、脚本 12、云函数 93，共 137 项单元/脚本测试，并完成格式、类型、lint、schema、i18n 和生产构建。真实低 Token 调用已返回 READY，17 个输入 Token、2 个输出 Token，约 1.524 秒。

覆盖 DeepSeek 独立凭据、端点规范化、关闭思考、三种思考强度、租户匿名标识、缓存用量、缓存价格、旧模型迁移、余额与鉴权错误、禁止重定向等回归。流式输出、工具循环和多轮 thinking 历史尚未在 MatrixFlow 产品中开放；本次适配不宣称实现这些功能。

## 实际云端发布记录

2026-10-10 已在既有 MatrixFlow AI 项目启用部署 `6ac9b81f6e08c4d6411c`，运行版本为 `4744e256e925e07ae449ea4aa1cd9d98abe320e2`。未新建 Appwrite 项目，也未写入 GitHub Secrets。

- `DEEPSEEK_API_KEY` 已存为 Function Secret，Worker Secret 和 API Key pepper 保留。
- Provider、端点、模型和思考强度已经切换；原有配置变量的 Secret 标记保留。部署脚本同样保留现有 Secret 属性，避免 Appwrite 拒绝将 Secret 降级为非 Secret。
- 现有 AI 员工的模型由旧网关别名更新为 `deepseek-flash`，其 ACTIVE 状态、提示词和团队归属保持原值。
- 新代码云端构建成功，耗时 4 秒；活动部署 ID 核对正确。
- 实际 `/readyz` 返回 HTTP 200，Provider 和 Worker 均就绪。
- 隔离临时账号/团队的受保护 `/health` 确认 Provider=deepseek、model=deepseek-flash、release 与发布版本一致。
- 浏览器等价会话直接创建 Agent 行被拒绝；经 Function 创建成功并自动选用 Flash。
- 云端 Agent 运行状态 COMPLETED，实际返回 READY，协议为 anthropic-messages；单次运行约 1.553 秒。该测量是低 Token 验证结果，不代表持续性能保证。
- 测试后清理 13 条临时业务行，删除临时团队、用户与会话；安全审计按既有保留策略留存。
- 本地 14 项 Chromium 回归全部通过。

激活前的生产部署为 `6aa4f1dfcd45d526778f`。如需回滚代码，可通过 `appwrite functions update-function-deployment` 切回该 ID；配置回滚需同步恢复当时的 Provider 变量，并重新构建以应用配置。该旧版本的 AI Provider 原本未就绪，回滚不能替代有效供应商密钥配置。

本次核对常见 DeepSeek 钥匙串条目未发现匹配项，最终使用用户提供的凭据，通过不回显的内存输入完成验证和 Secret 配置。密钥没有写入源码、环境文件、部署包或本报告。
