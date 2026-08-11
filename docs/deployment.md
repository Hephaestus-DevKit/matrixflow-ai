# 部署手册

## 目标拓扑

- Web：Vercel（或任何支持 Next.js 15 的 Node.js 平台）。
- Backend：Appwrite Cloud Singapore 项目。
- Function：Appwrite Node.js 22 Runtime `matrixflow-core`。
- AI：GLM 或 OpenAI，由函数变量提供密钥。

## 发布前

```bash
pnpm install --frozen-lockfile
npm ci --prefix apps/functions/matrixflow-core
pnpm verify
pnpm function:check
pnpm function:test
pnpm audit --prod --audit-level=high
npm audit --omit=dev --prefix apps/functions/matrixflow-core
```

确认 `appwrite.config.json` 与 `infra/appwrite` 的变更经过审查，且仓库、日志和构建产物中没有真实密钥。

## Appwrite 资源

创建短期 API key，通过环境变量注入，不写入 `.env`：

```bash
MATRIXFLOW_DEPLOY_KEY=... pnpm appwrite:provision
appwrite push functions
```

初始化脚本是幂等的，会创建或复用数据库、表、索引和文件桶。函数发布后，在 Appwrite Console 设置 `GLM_API_KEY` 或 `OPENAI_API_KEY`，再部署一个新版本使变量生效。

## Web 发布

设置公开变量：

```text
NEXT_PUBLIC_APPWRITE_ENDPOINT=https://sgp.cloud.appwrite.io/v1
NEXT_PUBLIC_APPWRITE_PROJECT_ID=<project-id>
```

Appwrite Web Platform 同时登记生产域名和 `localhost`。向 `main` 推送后由 Vercel 自动发布；发布状态成功后再切换流量。

## 验证

使用专用测试账号或一次性凭据运行 `scripts/smoke.mjs`，覆盖：

1. 登录和邮箱验证状态；
2. Appwrite Team 成员关系；
3. 团队数据行读写和跨团队不可见；
4. `matrixflow-core` 的 `/health`；
5. 测试数据删除。

随后人工验证注册、登录、组织切换、知识库上传和工作流 true/false 分支。未配置 AI key 时应收到明确的 503 配置错误；这属于预期失败关闭。

## 收尾

- 撤销部署 API key，删除本地临时 key 文件。
- 删除 smoke test 数据和不需要的会话。
- 检查 GitHub CI、CodeQL、Vercel 和 Appwrite Function deployment 均为成功。
- 记录 deployment ID、Git commit 和回滚点。

## 回滚

- Web：在 Vercel 将上一个成功 deployment 设为生产。
- Function：在 Appwrite Deployments 中激活上一个成功 deployment。
- Schema：只做向后兼容扩展；删除列或表需先停止旧代码写入、备份数据并单独审批。
- 凭据泄露：先撤销/轮换，再调查日志，不能仅重新部署。
