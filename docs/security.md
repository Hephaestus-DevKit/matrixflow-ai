# MatrixFlow AI · 安全合规方案

对应主文档 §13。本文件给出每项安全措施的具体落地。

## 1. 认证安全
- JWT access 15min + refresh 7d，refresh rotation
- bcrypt rounds=12
- 2FA（P1）：TOTP
- 密码重置：一次性 token，15min 过期

## 2. API Key 安全
- 存储 bcrypt hash，只显示一次明文
- scope 限定（最小权限）
- 过期时间 + IP 白名单（P1）
- 撤销机制

## 3. 多租户隔离
- 所有业务表带 `organization_id`
- 应用层：OrgInterceptor 注入 + Guard 校验
- PG 行级安全（RLS）P1：`CREATE POLICY ... USING (organization_id = current_setting('app.org_id')::uuid)`
- 查询永远 `WHERE organization_id = ?`

## 4. 文件上传安全
- 类型白名单（pdf/docx/xlsx/txt/md/csv/png/jpg/webp）
- 大小限制 20MB
- 病毒扫描（P1：ClamAV sidecar）
- MinIO bucket 隔离 + 预签名 URL

## 5. RAG 数据泄露防护
- 检索永远按 `organization_id` 过滤
- 引用不跨租户
- 敏感字段脱敏后入库

## 6. Prompt Injection 防护
- 用户输入做变量隔离（不拼字符串）
- 关键词检测 + 模型分类
- 输出 JSON Schema 强校验

## 7. Agent 工具权限
- 工具白名单（`agent_tools` 表）
- 参数 Zod schema 校验
- 高危工具（发送邮件/付款）人工审批（P1）

## 8. 工作流沙箱
- 节点超时 30s
- 资源限制（内存/CPU）
- 危险操作（删除/外部调用）白名单

## 9. 审计日志
- 所有写操作 + AI 调用 + 登录
- `audit_logs` 表，不可篡改（P1：append-only + 签名）

## 10. 内容安全
- 关键词过滤
- 模型分类（P1）
- 用户举报机制

## 11. 计费风控
- 异常用量告警（单分钟 >100 次）
- 欠费限流（403）
- 防刷：IP + 设备指纹 + 验证码

## 12. 合规
- GDPR：数据导出/删除 API、Cookie 同意
- 中国数据出境：区域化部署
- PCI DSS：不存信用卡，全走 Stripe
- SOC 2（P2）

## 13. 加密
- 传输：TLS 1.3
- 存储：PG at-rest（云托管）、MinIO SSE
- 密钥：KMS（P1）
- API Key/Token：bcrypt hash
