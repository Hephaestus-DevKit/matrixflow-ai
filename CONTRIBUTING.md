# Contributing

本仓库采用短分支、受保护主分支和 CI 门禁。

## 开发流程

1. 从最新 `main` 创建 `codex/<topic>` 或 `feat/<topic>` 分支。
2. 运行 `pnpm install --frozen-lockfile` 和函数目录的 `npm ci`。
3. 为行为变更补测试，优先覆盖租户隔离、权限、失败、条件分支和输入边界。
4. 提交前运行 README 的全部质量检查。
5. 通过 Pull Request 合并，说明 Appwrite schema、函数、回滚和验证结果。

## 代码约定

- Appwrite Team ID 是唯一组织 ID；不信任客户端传入的用户、角色、价格、状态或审计字段。
- 数据表变化同步更新 `infra/appwrite`、初始化脚本、共享契约和文档。
- 特权逻辑放在云函数并先校验团队成员关系；浏览器不持有 API key。
- 外部调用必须限制输入、超时和错误输出，并在未配置时失败关闭。
- 跨端契约归属 `packages/shared`，页面到 Appwrite 的映射归属 `apps/web/src/lib/backend`。
- 不提交 `.env`、凭据、个人数据、构建产物或 smoke test 数据。

建议使用 Conventional Commits。安全漏洞不要提交公开 Issue，请按 [SECURITY.md](SECURITY.md) 报告。
