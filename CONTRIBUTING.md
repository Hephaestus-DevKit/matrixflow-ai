# 贡献指南

本仓库采用短分支和受保护的 `main`。请先确认改动符合 [LICENSE](LICENSE)。

1. 从最新 `main` 建立工作分支，按 [README 的本地开发说明](README.md#本地开发) 安装依赖。
2. 涉及登录、写入或模型调用时，使用隔离的 Appwrite 项目，不用生产团队数据进行开发测试。
3. 行为变更应覆盖相关成功和失败路径，尤其是团队权限、输入边界和重试。仅改文档时，检查格式、链接及文档与实现是否一致即可。
4. 提交 PR，说明用户影响、验证结果、发布或回滚步骤。合并前等待 CI 和 CodeQL。

```bash
pnpm verify
pnpm exec playwright install webkit
pnpm test:e2e
pnpm audit --prod --audit-level=high
npm audit --omit=dev --audit-level=high --prefix apps/functions/matrixflow-core
```

- Appwrite Team ID 是租户边界。业务写入须经过 Function 授权，客户端不能指定可信角色、价格或审计字段。
- 表结构改动同步更新 `infra/appwrite`、初始化脚本、相关契约和文档。
- 跨端类型放在 `packages/shared`，Web 的 Appwrite 访问封装位于 `apps/web/src/lib/backend`。
- 不提交凭据、本地环境文件、个人数据、构建产物和测试数据。
- 主版本依赖升级需要审查兼容性，并跑完整 CI；不要为通过检查而跳过依赖审计。

普通问题可使用 [GitHub Issues](https://github.com/Hephaestus-DevKit/matrixflow-ai/issues)。漏洞请按 [安全政策](SECURITY.md) 私下报告。
