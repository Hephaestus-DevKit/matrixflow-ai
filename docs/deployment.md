# 部署手册

[文档导航](README.md) · [生产站点](https://matrixflow-ai-sycamore-tree.vercel.app) · [运行与恢复基线](operations.md)

前端由 Vercel 从 `main` 部署。后端是 Appwrite Cloud Singapore 的 Node.js 22 函数 `matrixflow-core`，生产 AI 使用 DeepSeek Flash。独立部署时，请为开发、验收和生产使用不同的 Appwrite 项目。

## 发布前

```bash
pnpm install --frozen-lockfile
npm ci --prefix apps/functions/matrixflow-core
pnpm verify
/usr/bin/safaridriver --enable  # macOS, one-time setup
pnpm test:e2e
```

生产依赖审计由 [MatrixFlow CI](https://github.com/Hephaestus-DevKit/matrixflow-ai/actions/workflows/ci.yml) 执行。涉及数据表时，审查 `appwrite.config.json` 与 `infra/appwrite/`，确认部署、旧客户端和回滚版本对结构变更兼容。

`pnpm readiness:audit` 检查配置形状；`pnpm readiness:audit:strict` 还要求支付、告警及近期备份与恢复演练等运营证据。严格审核与线上 smoke 是不同的检查，后者通过不代表商业发布条件已全部就绪。

## Appwrite 自动部署

[Appwrite deploy](https://github.com/Hephaestus-DevKit/matrixflow-ai/actions/workflows/appwrite.yml) 在 `main` 的函数或基础设施变更后触发，也可在 Actions 中对 `main` 手动运行。它依次检查凭据、跑后端测试、同步 Schema 和存储桶、发布并激活函数，然后执行真实后端 smoke。

在 [GitHub Actions repository secrets](https://github.com/Hephaestus-DevKit/matrixflow-ai/settings/secrets/actions) 配置：

| Secret                     | 用途                                          |
| -------------------------- | --------------------------------------------- |
| `MATRIXFLOW_DEPLOY_KEY`    | Appwrite 项目部署密钥，用于同步资源和发布函数 |
| `MATRIXFLOW_TEST_EMAIL`    | 已验证邮箱的专用测试账号                      |
| `MATRIXFLOW_TEST_PASSWORD` | 专用账号密码                                  |

脚本使用专用账号为每次验收创建隔离团队和短期 API Key。任何一项缺失都会在改动 Appwrite 前使工作流失败。

部署密钥只需要下列资源的 `.read` 和 `.write` 权限：`databases`、`tables`、`columns`、`indexes`、`buckets`、`functions`。函数变量与代码部署使用 Functions 权限。给密钥设置有效期；轮换时先验证替换的 Secret，再撤销旧密钥。手动发布使用的临时密钥应在结束后撤销。不要将密钥写进终端历史、环境样例、源码或运行日志。

### Function 变量

当前生产配置在 Appwrite Console 的 `matrixflow-core` 中维护：

```text
MATRIXFLOW_AI_PROVIDER=deepseek
DEEPSEEK_MODEL=deepseek-flash
DEEPSEEK_BASE_URL=https://api.deepseek.com/anthropic
DEEPSEEK_REASONING_EFFORT=none
```

- `DEEPSEEK_API_KEY`、`MATRIXFLOW_WORKER_SECRET` 与 `MATRIXFLOW_API_KEY_PEPPER` 存为 **Function Secret**。Worker Secret 和 pepper 使用至少 32 个字符的独立随机值。pepper 更换会影响已有 MatrixFlow API Key，需协调轮换。
- 自动部署分页读取现有变量并保留 Secret 标记。部署脚本维护生产 Provider、限额和版本等非敏感变量；变更它们时一并检查 [deploy.mjs](../apps/functions/matrixflow-core/scripts/deploy.mjs)，避免下一次 CI 覆盖控制台手改值。
- 手动上传函数时不要用 `--with-variables`，避免用本地声明替换控制台中的 Secret。变更函数变量后，需要新部署使配置生效。
- 其他模型、计费和就绪配置见[配置样例](../.env.example)、[模型适配](deepseek-adapter.md)和[计费说明](billing.md)。部署密钥和测试账号不属于 Web 构建变量。

### 手动发布

只有在需要单独发布或诊断时，使用已授权的 Appwrite CLI 会话。先核对项目，再将 `src/`、`package.json` 和 `package-lock.json` 放入干净的临时目录，不包含本地依赖、凭据或测试数据。以下示例假设 `FUNCTION_STAGE_DIR` 已指向该目录：

```bash
appwrite functions create-deployment \
  --function-id matrixflow-core \
  --code "${FUNCTION_STAGE_DIR:?set the staged function directory}" \
  --activate=false \
  --entrypoint src/main.js \
  --commands "npm ci --omit=dev"
```

构建就绪后，在 Appwrite Console 激活对应部署。若同时修改 Schema，应先审查差异，再通过自动工作流或使用安全注入的临时 `MATRIXFLOW_DEPLOY_KEY` 运行 `pnpm appwrite:provision`。

## Web 发布

在 Vercel 配置以下变量。换用其他 Appwrite 项目或公开域名时，使用目标环境对应的值：

```text
NEXT_PUBLIC_APPWRITE_ENDPOINT=https://sgp.cloud.appwrite.io/v1
NEXT_PUBLIC_APPWRITE_PROJECT_ID=<project-id>
MATRIXFLOW_PUBLIC_URL=https://matrixflow-ai-sycamore-tree.vercel.app
```

在 Appwrite Web Platforms 登记生产域名和需要访问该项目的本地域名。更改 Web 构建变量后重新部署；现有构建不会自动读取新值。独立站点执行公开 smoke 时，应同时设置 `MATRIXFLOW_PRODUCTION_URL` 和 `MATRIXFLOW_CANONICAL_URL`。

## 发布验收与回滚

1. 核对 `main` 提交、CI、Vercel 发布状态与 Appwrite **active deployment ID**。
2. 查看 Appwrite 工作流的 Smoke test，核对运行中的 Function 版本与发布提交。脚本用团队 API Key 直连生产域名，验证空请求体 GET、权限范围、团队隔离，并完成 Shopify 翻译、审核和导出。验收后验证 Key 已撤销，并清理测试团队、业务数据和会话。
3. Vercel 发布成功后，在 `main` 手动运行 [Production smoke](https://github.com/Hephaestus-DevKit/matrixflow-ai/actions/workflows/production-smoke.yml)，或运行 `pnpm smoke:production`，验证六个公开页面、三语服务端首屏、canonical 与安全响应头。
4. 记录发布证据、上一个可用版本及必要的配置差异。回滚前端时恢复上一可用的 Vercel 生产部署；回滚后端时激活上一可用的 Appwrite 部署，再跑 smoke。数据表变更不会随函数回滚自动撤销，优先保持向后兼容。
