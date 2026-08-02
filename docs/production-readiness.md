# Production readiness

运行时基线为 Node.js ≥ 22.13、pnpm 11.9、PostgreSQL 16 + pgvector、Redis 7 和私有 S3/MinIO。

## 必需配置

生产启动会校验以下变量，缺失时直接退出：

- `DATABASE_URL`、`REDIS_URL`
- `MINIO_ENDPOINT`、`MINIO_ACCESS_KEY`、`MINIO_SECRET_KEY`
- `CORS_ALLOWED_ORIGINS`（不允许 `*`）
- `INTERNAL_JOB_SECRET`（至少 32 字符）
- `APPWRITE_PROJECT_ID` 与 HTTPS `APPWRITE_ENDPOINT`
- `GLM_API_KEY` 或 `OPENAI_API_KEY` 至少一个

同时为 Web 设置 `NEXT_PUBLIC_APPWRITE_PROJECT_ID` 和 `NEXT_PUBLIC_APPWRITE_ENDPOINT`。反向代理部署必须把 `TRUST_PROXY_HOPS` 设置为真实且精确的代理跳数。

## 部署顺序

1. 创建 PostgreSQL 16 + pgvector、Redis 与私有 MinIO bucket。
2. 执行 `pnpm db:migrate`；失败必须中止发布。
3. 启动 Python Sidecar、API 和 Worker。
4. 等待 `/api/v1/health/ready` 返回 200，再切换流量。
5. 执行登录、租户切换、文档解析、RAG 和工作流 smoke tests。

禁止在生产使用 `prisma db push`、`--accept-data-loss`、默认 Docker 密码或示例密钥。

## 发布门禁

- `pnpm install --frozen-lockfile`
- `pnpm db:generate`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`
- API E2E（PostgreSQL + Redis）
- `pnpm build`
- `pnpm audit --prod --audit-level=high`
- Docker 镜像构建

## 当前产品边界

- 免费计划和免费市场项目可直接开通；收费项目返回 HTTP 402，直到 Stripe 状态机上线。
- AI、条件、转换和 Webhook 工作流节点可执行。
- 邮件、人工审批、Schedule 节点和 Loop 节点会明确返回未实现错误，不会伪造成功。
- 文件解析支持 PDF、DOCX、TXT、Markdown 和 CSV。
