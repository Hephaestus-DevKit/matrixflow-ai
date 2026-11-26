# MatrixFlow AI

跨境电商团队的商品文案和翻译工作台。把规格与手册关联到项目，生成多渠道文案，核对来源并保存审核记录。Shopify 译文可以按批次翻译、审核，再导出可回传的 CSV。

[在线体验](https://matrixflow-ai-sycamore-tree.vercel.app) · [商品文案与 Shopify 翻译](docs/content-review-flow.md) · [本地开发](#本地开发) · [完整文档](docs/README.md)

![MatrixFlow AI 首页示例：从 MF92 越野包手册中的容量、重量和材质生成英文详情，再核对护理和保修信息](docs/images/product-home.png)

[![CI](https://github.com/Hephaestus-DevKit/matrixflow-ai/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/Hephaestus-DevKit/matrixflow-ai/actions/workflows/ci.yml)
[![CodeQL](https://github.com/Hephaestus-DevKit/matrixflow-ai/actions/workflows/codeql.yml/badge.svg?branch=main)](https://github.com/Hephaestus-DevKit/matrixflow-ai/actions/workflows/codeql.yml)
[![Appwrite deploy](https://github.com/Hephaestus-DevKit/matrixflow-ai/actions/workflows/appwrite.yml/badge.svg?branch=main)](https://github.com/Hephaestus-DevKit/matrixflow-ai/actions/workflows/appwrite.yml)
[![Production smoke](https://github.com/Hephaestus-DevKit/matrixflow-ai/actions/workflows/production-smoke.yml/badge.svg?branch=main)](https://github.com/Hephaestus-DevKit/matrixflow-ai/actions/workflows/production-smoke.yml)

在线体验由 Vercel 提供前端，Appwrite 处理登录、团队数据和 AI 请求。使用在线工作台生成内容会消耗运营方的 DeepSeek API 配额。自行部署时，请配置自己的 Appwrite 项目和 DeepSeek 密钥，详见[部署手册](docs/deployment.md)。

## 可以做什么

| 场景             | 当前能力                                                                                        |
| ---------------- | ----------------------------------------------------------------------------------------------- |
| 商品文案         | 按语言、市场和文风生成详情页、FAQ、广告等 12 类内容。团队可查看来源、编辑草稿、确认审核并导出。 |
| Shopify 翻译     | 导入店铺语言 CSV，在后台翻译空白字段，逐项审核并导出通过审核的译文。                            |
| 知识库与 AI 员工 | 索引 PDF、DOCX、TXT、Markdown 或 CSV。AI 员工可引用团队资料回答问题，保存运行历史。             |
| 工作流与任务     | 可视化编排、条件分支、JSON 输入和版本记录。可跟踪、取消后台任务及导出结果。                     |
| 团队协作         | 邮箱验证、可选双重验证、团队角色、用量和审计。界面支持简体中文、繁體中文与 English。            |

## 制作第一份商品详情页

1. 注册并验证邮箱。在「内容工厂」新建项目，填写已确认的规格，或点「填入示例商品」快速体验。
2. 需要引用手册时，先在知识库上传并索引文档，再在创建项目时关联该知识库。
3. 打开「商品详情页」，设置目标语言、市场和文风后生成草稿。对照商品资料和引用，核实规格与宣称。
4. 通过「保存草稿」交接给同事，或「确认审核」后复制、下载正文和审核记录。商品资料更新后，旧稿会保留供参考，重新生成后可以审核。

## 交付 Shopify 译文

在项目的「Shopify 翻译」中导入从 Shopify「设置 → 语言」导出的 UTF-8 CSV。每批支持 40 个商品字段，覆盖标题、详情、SEO 标题和 SEO 描述。后台任务完成后核对译文，导出已审核行，再到 Shopify 导入。 [示例 CSV](apps/web/public/examples/shopify-translations.csv) · [操作说明和支持范围](docs/content-review-flow.md#shopify-翻译表交付)

当前为 **Beta**。模板市场仍在预览，付费结账和外部消息发送需要额外配置。知识库使用关键词与片段检索，适合中小型资料集。 [产品成熟度与边界](docs/product-readiness.md)

## 架构与目录

生产前端运行在 **Vercel（Next.js 15）**，Appwrite Cloud Singapore 提供认证、团队、TablesDB、文件存储和 Node.js 22 函数。业务写入统一通过 `matrixflow-core` 校验团队、角色、输入和额度；浏览器只读取权限允许的数据。生产模型为 **DeepSeek Flash**，通过兼容 Anthropic Messages 的接口在函数内调用。

| 路径                                                             | 用途                                       |
| ---------------------------------------------------------------- | ------------------------------------------ |
| [apps/web](apps/web)                                             | Next.js 界面、语言和数据访问               |
| [apps/functions/matrixflow-core](apps/functions/matrixflow-core) | Appwrite 函数、AI 适配、后台任务和后端测试 |
| [packages/shared](packages/shared)                               | TypeScript 类型与 Zod 4 校验               |
| [infra/appwrite](infra/appwrite)                                 | 数据库、存储桶和函数声明                   |
| [e2e](e2e) · [scripts](scripts)                                  | 浏览器回归、配置审计和 smoke               |
| [docs](docs)                                                     | 架构、API、部署与生产运维                  |

## 本地开发

使用 Node.js 22.14+ 和 pnpm 11。从仓库根目录运行：

```bash
pnpm install --frozen-lockfile
npm ci --prefix apps/functions/matrixflow-core
pnpm dev
```

访问 <http://localhost:3000>。只看公开页面无需配置密钥。Web 的默认 Appwrite 配置指向生产项目；开发登录、写入或 AI 调用时，请先把 [配置样例](.env.example) 中的 `NEXT_PUBLIC_APPWRITE_ENDPOINT` 和 `NEXT_PUBLIC_APPWRITE_PROJECT_ID` 填入 `apps/web/.env.local`，并改为隔离的开发项目。模型密钥只存于 Appwrite Function Secret。

```bash
pnpm verify
# 本地和 macOS CI 均运行原生 Safari 浏览器回归。
/usr/bin/safaridriver --enable  # macOS, one-time setup
pnpm test:e2e
```

[贡献指南](CONTRIBUTING.md) 列出其他检查和 PR 要求。

## 发布与验收

- **前端：** Vercel 从 `main` 发布。定时或手动运行的 [Production smoke](https://github.com/Hephaestus-DevKit/matrixflow-ai/actions/workflows/production-smoke.yml) 检查六个公开页面、三语首屏与安全响应头。
- **后端：** `main` 的函数或 Appwrite 配置变更触发 [Appwrite deploy](https://github.com/Hephaestus-DevKit/matrixflow-ai/actions/workflows/appwrite.yml)。工作流同步资源、激活函数，并用专用账号验证发布版本、团队读写权限、真实模型和翻译交付。
- **运维：** 发布账号、Secrets、回滚及模型配置见[部署手册](docs/deployment.md)；监控与恢复目标见[生产运行基线](docs/operations.md)。

安全问题请按 [SECURITY.md](SECURITY.md) 私下报告。源代码公开可见，使用、修改或部署须遵守 [LICENSE](LICENSE)。
