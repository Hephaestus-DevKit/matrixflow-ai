# Appwrite 连接与构建验证

日期：2026-10-10（Asia/Shanghai）。代码提交：`025f38a`。

通过本机 Appwrite CLI 28.3.0 的现有登录会话访问现有项目，未新建项目、未修改套餐，也未创建部署 API Key。

| 检查                  | 实际结果                                                                                        |
| --------------------- | ----------------------------------------------------------------------------------------------- |
| 项目                  | MatrixFlow AI，`6a43f0af000862e7b0ef`，Singapore                                                |
| 数据库                | `matrixflow` 已启用，29 张数据表已启用并开启行权限                                              |
| 活动 Function         | `matrixflow-core`，Node.js 22，已启用                                                           |
| 存活探针              | `GET /healthz` 返回 HTTP 200                                                                    |
| 就绪探针              | `GET /readyz` 返回 HTTP 503，Provider 未配置；Worker 已就绪；计费处于可选降级状态               |
| Function 变量         | 已存在 Worker Secret、API Key pepper；不存在 TOKENRHYTHM_API_KEY 或其他受支持 Provider 密钥变量 |
| 项目变量              | 0 个，未发现可供 Function 继承的 Provider 密钥                                                  |
| 历史 API Key 幂等记录 | 按 path=/api-keys 统计，结果为 0；查询未读取 response 字段                                      |
| 新代码部署            | `6ac9adb4e7d84f6773b4`，构建 ready，耗时 5 秒，activate=false                                   |
| 当前活动部署          | 保留 `6aa4f1dfcd45d526778f`                                                                     |

`live=false` 的官方 SDK 字段含义是当前活动部署尚未应用最新配置，并不表示现有 Function 无法执行；实际存活探针已返回 200。

上传包仅包含本地提交的 src、package.json 和 package-lock.json，不包含依赖目录、测试、环境文件或凭据。构建成功证明 CLI 登录会话有现有项目的上传/构建权限，但未完成新版本运行时验收，也未替换当前活动部署。

继续上线需先在 MatrixFlow Core 的 Function 变量中添加当前配置所需的 `TOKENRHYTHM_API_KEY`，并标记为 Secret；若改用其他供应商，需要同步调整 Provider、端点和模型。然后重新构建以应用配置，验证真实 AI 调用和团队权限后再完成发布。密钥只应保存到 Appwrite Secret 变量中，不进入仓库或聊天记录。

本次只创建了代码构建和两条公开探针执行记录；未读取业务行正文、删除历史记录或改变项目/组织资源配额。
