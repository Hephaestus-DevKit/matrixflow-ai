# 计费适配边界

MatrixFlow 不在浏览器或 Function 内猜测扣款结果。支付供应商必须先由独立适配层验证供应商签名、映射组织和订阅，再使用原始规范化 JSON 的 HMAC 请求 `/billing/webhook`。

## 规范化事件

支持的事件包括：

- `checkout.completed`
- `subscription.created` / `subscription.updated` / `subscription.canceled` / `subscription.deleted`
- `invoice.paid` / `invoice.payment_failed`
- `payment.refunded` / `payment.chargeback`

每个事件必须包含唯一 `eventId`、`organizationId`、`subscriptionId`、计划、状态和席位；发票与交易对象分别写入 `billing_invoices`、`billing_transactions`。重复 `eventId` 返回 accepted/duplicate，不重复改变权益。

## 权益规则

只有 `active` 和未过期的 `trialing` 订阅获得 Pro/Team 权益；`past_due`、`unpaid`、`paused`、`canceled` 和 `incomplete` 不会自动获得完整权益。供应商重试事件必须保持幂等，不能由浏览器传入套餐或席位覆盖服务端状态。

## 上线验收

在正式收费前，至少使用供应商测试环境验证：首次 checkout、重复 webhook、续费、换套餐、取消、支付失败、恢复、退款、拒付、发票链接和欠费降级。生产环境还要配置税率/发票主体、退款权限、通知模板、对账和有人值守告警。

生产 Stripe 回调地址为 `/billing/stripe-webhook`，需要 `STRIPE_WEBHOOK_SECRET` 验证 Stripe 原始签名，并同时配置 `MATRIXFLOW_BILLING_WEBHOOK_SECRET` 作为内部规范化事件签名。通用 `/billing/webhook` 仍可供其他供应商适配层使用。

当前仓库提供的是安全适配边界与数据模型；未配置真实支付供应商时，产品继续保持 Free 预览并明确拒绝 checkout，不会伪造订单或扣款。
