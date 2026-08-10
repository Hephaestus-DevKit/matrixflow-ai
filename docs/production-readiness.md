# 生产部署与运行手册

运行基线：Node.js 22、pnpm 11、Python 3.12、PostgreSQL 16 + pgvector、Redis 7、私有 S3/MinIO。

## 必需配置

生产 API 会在启动时校验：

- `DATABASE_URL`、`REDIS_URL`
- 非通配符 `CORS_ALLOWED_ORIGINS`
- 至少 32 字符的 `INTERNAL_JOB_SECRET` 与 `METRICS_TOKEN`
- Appwrite 模式下的 `APPWRITE_PROJECT_ID` 与 HTTPS `APPWRITE_ENDPOINT`
- 本地认证模式下至少 32 字符的 `JWT_SECRET`
- 默认需要 `MINIO_ENDPOINT`、`MINIO_ACCESS_KEY`、`MINIO_SECRET_KEY`
- 默认需要 `GLM_API_KEY` 或 `OPENAI_API_KEY` 至少一个

Web 还需要 `NEXT_PUBLIC_APPWRITE_PROJECT_ID`、`NEXT_PUBLIC_APPWRITE_ENDPOINT` 和 `NEXT_PUBLIC_API_BASE_URL`。反向代理部署必须将 `TRUST_PROXY_HOPS` 设为真实且精确的代理跳数。所有密钥应由 Secret Manager 注入，不写入镜像或仓库。

身份认证等核心能力可以在受限环境中独立部署：将 `AI_PROVIDER_REQUIRED=false` 或 `OBJECT_STORAGE_REQUIRED=false` 可允许对应集成缺失时降级启动。此时 AI 或文件相关接口不会伪造成功；`/health/ready` 会把未配置的对象存储报告为 `down`，整体状态为 `degraded`，但数据库或 Redis 故障仍返回 503。完整产品部署应保留两个开关的默认值 `true`。

## 镜像与职责

- `infra/docker/api.Dockerfile`：API 运行镜像；`builder` target 供一次性 migration 使用。
- `infra/docker/worker.Dockerfile`：Worker 独立运行镜像。
- `apps/sidecar/Dockerfile`：Python 解析服务，依赖由 hash 锁定。
- 根 `Dockerfile`：Hugging Face/单容器环境，组合 API、Worker 和 Sidecar。

常规生产环境优先使用独立镜像，以便分别扩缩容、限权和发布。组合镜像只用于平台限制为单容器的环境。

## 发布顺序

1. 备份数据库和对象存储，并记录当前应用/镜像版本。
2. 创建 PostgreSQL + pgvector、Redis 和私有对象存储；使用独立最小权限凭据。
3. 运行一次性 migration job：`pnpm db:migrate`。失败立即中止，不启动新版本。
4. 部署 Sidecar、API 和 Worker；先不接入外部流量。
5. 等待 `/api/v1/health/live` 和 `/api/v1/health/ready` 返回 200；完整部署的 readiness 必须为 `ready`，明确采用降级部署时允许为 `degraded`。
6. 运行登录、组织切换与缓存隔离、内容生成、文件解析、RAG、CRM 和工作流 smoke test，并检查桌面与移动断点。
7. 小流量切换，观察错误率、延迟、队列积压和数据库连接，再完成发布。

禁止在生产使用 `prisma db push`、`--accept-data-loss`、示例密钥、默认对象存储密码或开放的 Sidecar 端口。

## 发布门禁

```bash
pnpm install --frozen-lockfile
pnpm db:generate
pnpm format:check
pnpm typecheck
pnpm lint
pnpm test:coverage
pnpm --filter @matrixflow/api test:e2e
pnpm build
pnpm audit --prod --audit-level=high
```

Sidecar 必须在使用 `apps/sidecar/requirements.txt` 创建的 Python 3.12 环境中运行 `python -m unittest -v`。CI 还构建 API、Worker、Sidecar 与组合镜像，并执行 CodeQL。

## 回滚与恢复

- 应用失败但 migration 向后兼容：把 API/Worker 回滚到上一镜像并继续观察。
- migration 不兼容：不要自动执行破坏性 down migration；停止写流量，按该 migration 的人工恢复方案恢复备份或前向修复。
- Sidecar 失败：暂停文档队列，保留任务记录，修复后重试；不要标记虚假成功。
- Redis 故障：恢复后检查延迟任务和租约；数据库记录仍是任务状态事实来源。
- 对象存储故障：停止新上传/删除，避免数据库与对象状态继续分叉。

每次正式发布至少验证一次数据库恢复点；定期演练 PostgreSQL 和对象存储的联合恢复。

## 可观测性

- Prometheus 抓取 `/api/v1/metrics` 时发送 `x-metrics-token`。
- 告警至少覆盖 API 5xx、p95 延迟、readiness、Worker 失败/积压、Sidecar 失败、数据库连接和磁盘/对象存储容量。
- 日志聚合系统应保留 request ID，但继续过滤 Authorization、Cookie 和 Set-Cookie。

## 当前产品边界

- 免费计划和免费市场项目可直接开通；收费订阅通过 PaymentProvider 端口委托，默认禁用适配器在 Stripe 状态机完成前返回 HTTP 402。
- AI、真实条件分支、转换和 Webhook 节点可执行；邮件通过 EmailDelivery 端口委托，默认禁用适配器会明确失败；人工审批、Schedule 和 Loop 仍返回未实现错误。
- 文件解析支持 PDF、DOCX、TXT、Markdown 和 CSV。
