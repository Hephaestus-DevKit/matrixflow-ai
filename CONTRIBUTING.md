# Contributing

本仓库采用短分支、受保护主分支和 CI 门禁。除紧急修复外，不直接向 `main` 提交。

## 开发流程

1. 从最新 `main` 创建 `codex/<topic>` 或 `feat/<topic>` 分支。
2. 安装锁定依赖：`pnpm install --frozen-lockfile`。
3. 数据结构变化必须创建新 Prisma migration，禁止修改已发布 migration。
4. 为行为变更补充单元或集成测试，尤其是租户隔离、权限、失败与并发路径。
5. 提交前运行 README 中的发布门禁（包括 `pnpm test:coverage`）；更新相关配置和文档。
6. 通过 Pull Request 合并，说明风险、migration、回滚和验证结果。

## 代码约定

- 使用 Prettier 和仓库 ESLint 配置，不通过关闭规则掩盖问题。
- Controller 不直接访问 Prisma；Service 的组织数据查询显式包含 `organizationId`。
- 不信任客户端传入的角色、用户、组织、价格、状态或审计字段。
- 外部网络调用必须有超时、取消、响应大小限制和安全错误映射。
- 跨端契约归属 `packages/shared`；外部 Provider 通过领域端口/适配器接入，不把供应商逻辑写入通用 Service。
- 不提交 `.env`、凭据、个人数据、构建产物、虚拟环境或生成的 Prisma Client。

## Commit 与 PR

建议使用 Conventional Commits，例如 `fix: enforce CRM tenant boundary`。PR 应保持单一目的；若包含 schema 变化，请列出部署顺序和向后兼容性。

安全漏洞不要提交公开 Issue，请按 [SECURITY.md](SECURITY.md) 报告。
