# MatrixFlow AI · 部署文档

## 一、本地开发部署

### 1. 前置要求
- Node.js ≥ 20.10
- pnpm ≥ 9 (`npm i -g pnpm`)
- Docker + Docker Compose

### 2. 启动步骤
```bash
cp .env.example .env          # 配置环境变量（至少填 GLM_API_KEY）
pnpm install                  # 安装依赖
docker compose up -d          # 启动 PG/Redis/MinIO/MailHog
pnpm db:generate              # 生成 Prisma Client
pnpm db:migrate:dev           # 创建 schema + 迁移
psql $DATABASE_URL -f scripts/sql/000_init.sql   # pgvector + 触发器
pnpm db:seed                  # 写入种子数据
pnpm dev                      # 启动 web(3000) + api(3001)
```

### 3. 验证
- http://localhost:3000 → 前端首页
- http://localhost:3001/api/v1/health → `{"status":"ok"}`
- http://localhost:3001/api/v1/docs → Swagger UI
- http://localhost:9001 → MinIO 控制台 (matrixflow/matrixflow123)

## 二、生产部署（Docker Compose 单机）

### 1. 构建
```bash
docker build -f infra/docker/api.Dockerfile -t matrixflow-api:latest .
docker build -f infra/docker/web.Dockerfile -t matrixflow-web:latest .
```

### 2. 生产 compose（infra/compose/prod.yml）
- api：NestJS prod mode
- web：Next.js standalone
- postgres：持久卷 + 备份
- redis：AOF + 密码
- minio：持久卷
- nginx：反代 + TLS

### 3. Nginx 配置要点
- HTTPS（Let's Encrypt）
- gzip + brotli
- SSE 不缓冲（`proxy_buffering off`）
- 静态资源 CDN

### 4. 环境变量
- 全部使用强随机 JWT_SECRET（64 字符）
- SECURE_COOKIES=true
- CORS_ORIGINS 设为正式域名
- 所有 AI API Key 从密钥管理服务读取（不写入 .env）

## 三、Kubernetes（P2）
- Helm chart 在 `infra/k8s/`
- Ingress + cert-manager
- HPA（api/worker 按 CPU + QPS）
- StatefulSet（PG/Redis）或托管服务

## 四、监控
- 日志：结构化 JSON → Loki
- 指标：OpenTelemetry → Prometheus + Grafana
- 错误：Sentry
- 告警：Grafana Alerting → Slack/PagerDuty

## 五、备份
- PG：每日 `pg_dump` + S3 上传
- MinIO：版本化 + 跨区域复制
- Redis：AOF + 定时快照
