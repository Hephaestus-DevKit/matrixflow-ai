import { createHmac, timingSafeEqual } from 'node:crypto';
import { HttpError } from './runtime.js';

const DEFAULT_PUBLIC_URL = 'https://matrixflow-ai.vercel.app';

function value(env, key) {
  return typeof env?.[key] === 'string' ? env[key].trim() : '';
}

function publicOrigin(env) {
  try {
    const url = new URL(value(env, 'MATRIXFLOW_PUBLIC_URL') || DEFAULT_PUBLIC_URL);
    const production = String(env?.NODE_ENV || 'production').toLowerCase() === 'production';
    if (production && url.protocol !== 'https:')
      throw new HttpError('生产公开地址必须使用 HTTPS', 500, 'BILLING_CONFIG_INVALID');
    if (url.username || url.password || url.hash || url.search)
      throw new HttpError(
        '生产公开地址不得包含凭据、查询参数或片段',
        500,
        'BILLING_CONFIG_INVALID',
      );
    return url.origin;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError('生产公开地址配置无效', 500, 'BILLING_CONFIG_INVALID');
  }
}

function safeReturnUrl(input, fallbackPath, env) {
  const origin = publicOrigin(env);
  let url;
  try {
    url = new URL(input || fallbackPath, origin);
  } catch {
    throw new HttpError('支付返回地址无效', 400, 'BILLING_RETURN_URL_INVALID');
  }
  if (url.origin !== origin)
    throw new HttpError(
      '支付返回地址必须属于 MatrixFlow 生产域名',
      400,
      'BILLING_RETURN_URL_INVALID',
    );
  return url.toString();
}

export function billingProviderReadiness(env = process.env) {
  const provider = value(env, 'MATRIXFLOW_BILLING_PROVIDER').toLowerCase();
  const secret = value(env, 'STRIPE_SECRET_KEY');
  const prices = {
    pro: value(env, 'STRIPE_PRICE_PRO'),
    team: value(env, 'STRIPE_PRICE_TEAM'),
  };
  const production = String(env?.NODE_ENV || '').toLowerCase() === 'production';
  const keyAllowed =
    !production ||
    secret.startsWith('sk_live_') ||
    value(env, 'MATRIXFLOW_ALLOW_TEST_BILLING') === 'true';
  const ready =
    provider === 'stripe' &&
    Boolean(secret) &&
    keyAllowed &&
    Boolean(prices.pro) &&
    Boolean(prices.team);
  return {
    ready,
    provider: provider || null,
    checkout: ready,
    webhook:
      Boolean(value(env, 'MATRIXFLOW_BILLING_WEBHOOK_SECRET')) &&
      (provider !== 'stripe' || Boolean(value(env, 'STRIPE_WEBHOOK_SECRET'))),
    plans: Object.fromEntries(
      Object.entries(prices).map(([plan, price]) => [plan, Boolean(price)]),
    ),
  };
}

export async function createCheckoutSession(
  { planId, seats, successUrl, cancelUrl, organizationId },
  env = process.env,
) {
  const readiness = billingProviderReadiness(env);
  if (!readiness.ready)
    throw new HttpError('付费结账尚未配置支付供应商', 503, 'BILLING_PROVIDER_NOT_CONFIGURED');
  if (!['pro', 'team'].includes(planId))
    throw new HttpError('当前套餐不可结账', 400, 'BILLING_PLAN_INVALID');
  const priceId = value(env, planId === 'pro' ? 'STRIPE_PRICE_PRO' : 'STRIPE_PRICE_TEAM');
  const params = new URLSearchParams();
  params.set('mode', 'subscription');
  params.set('line_items[0][price]', priceId);
  params.set(
    'line_items[0][quantity]',
    String(Math.min(500, Math.max(1, Math.floor(Number(seats) || 1)))),
  );
  params.set('success_url', safeReturnUrl(successUrl, '/dashboard/billing?checkout=success', env));
  params.set('cancel_url', safeReturnUrl(cancelUrl, '/dashboard/billing?checkout=cancel', env));
  params.set('client_reference_id', organizationId);
  params.set('metadata[organizationId]', organizationId);
  params.set('metadata[planId]', planId);
  params.set('subscription_data[metadata][organizationId]', organizationId);
  params.set('subscription_data[metadata][planId]', planId);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${value(env, 'STRIPE_SECRET_KEY')}`,
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: params,
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new HttpError('支付供应商暂时不可用', 502, 'BILLING_PROVIDER_ERROR');
    if (!payload?.id || !payload?.url)
      throw new HttpError('支付供应商返回的结账地址无效', 502, 'BILLING_PROVIDER_ERROR');
    return { provider: 'stripe', sessionId: payload.id, checkoutUrl: payload.url };
  } catch (error) {
    if (error instanceof HttpError) throw error;
    if (error?.name === 'AbortError')
      throw new HttpError('支付供应商响应超时', 504, 'BILLING_PROVIDER_TIMEOUT');
    throw new HttpError('无法连接支付供应商', 502, 'BILLING_PROVIDER_ERROR');
  } finally {
    clearTimeout(timeout);
  }
}

export function stripeSignature(rawBody, timestamp, secret) {
  return createHmac('sha256', secret).update(`${timestamp}.${rawBody}`, 'utf8').digest('hex');
}

export function isValidStripeSignature(rawBody, provided, secret, now = Date.now()) {
  if (!secret || typeof provided !== 'string') return false;
  const parts = provided
    .split(',')
    .map((part) => part.trim().split('='))
    .filter(([key, value]) => key && value);
  const timestamp = Number(parts.find(([key]) => key === 't')?.[1]);
  if (!Number.isFinite(timestamp) || Math.abs(now / 1_000 - timestamp) > 300) return false;
  const expected = stripeSignature(rawBody, timestamp, secret);
  const wanted = Buffer.from(expected, 'utf8');
  return parts
    .filter(([key]) => key === 'v1')
    .some(([, value]) => {
      const actual = Buffer.from(String(value), 'utf8');
      return actual.length === wanted.length && timingSafeEqual(actual, wanted);
    });
}

function unixDate(value) {
  const timestamp = Number(value);
  return Number.isFinite(timestamp) && timestamp > 0
    ? new Date(timestamp * 1_000).toISOString()
    : undefined;
}

function planForPrice(priceId, env) {
  if (priceId && priceId === value(env, 'STRIPE_PRICE_TEAM')) return 'team';
  if (priceId && priceId === value(env, 'STRIPE_PRICE_PRO')) return 'pro';
  return 'free';
}

function subscriptionStatus(status) {
  if (status === 'trialing') return 'trialing';
  if (status === 'active') return 'active';
  if (status === 'past_due') return 'past_due';
  if (status === 'unpaid') return 'unpaid';
  if (status === 'paused') return 'paused';
  if (status === 'incomplete') return 'incomplete';
  return 'canceled';
}

function objectId(value) {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && typeof value.id === 'string') return value.id;
  return '';
}

function eventMetadata(object) {
  return Object.assign(
    {},
    object?.parent?.subscription_details?.metadata || {},
    object?.subscription_details?.metadata || {},
    object?.lines?.data?.[0]?.metadata || {},
    object?.metadata || {},
  );
}

function eventSubscriptionId(eventType, object, metadata) {
  const linked =
    objectId(object.subscription) ||
    objectId(object.parent?.subscription_details?.subscription) ||
    objectId(object.subscription_details?.subscription) ||
    String(metadata.subscriptionId || '').trim();
  if (linked) return linked;
  if (eventType.startsWith('customer.subscription.')) return objectId(object);
  return '';
}

/** Convert a verified Stripe event into the internal billing webhook schema. */
export function normalizeStripeEvent(event, env = process.env) {
  if (!event || typeof event !== 'object' || typeof event.type !== 'string')
    throw new HttpError('Stripe 事件格式无效', 400, 'BILLING_EVENT_INVALID');
  const object = event.data?.object || {};
  const metadata = eventMetadata(object);
  const organizationId = String(metadata.organizationId || object.client_reference_id || '').trim();
  if (!organizationId)
    throw new HttpError('Stripe 事件缺少组织标识', 400, 'BILLING_EVENT_ORGANIZATION_MISSING');
  const subscriptionId = eventSubscriptionId(event.type, object, metadata);
  if (!subscriptionId)
    throw new HttpError('Stripe 事件缺少订阅标识', 400, 'BILLING_EVENT_SUBSCRIPTION_MISSING');
  const priceId = object.items?.data?.[0]?.price?.id || object.lines?.data?.[0]?.price?.id;
  const planId = metadata.planId || planForPrice(priceId, env);
  const base = {
    eventId: String(event.id || '').trim(),
    organizationId,
    provider: 'stripe',
    type: 'subscription.updated',
    subscriptionId,
    planId: ['free', 'pro', 'team'].includes(planId) ? planId : 'free',
    status: 'active',
    seats: Math.min(
      500,
      Math.max(1, Number(object.quantity || object.items?.data?.[0]?.quantity || 1)),
    ),
    currentPeriodStart: unixDate(object.current_period_start),
    currentPeriodEnd: unixDate(object.current_period_end),
    metadata: { stripeEventType: event.type, stripeObjectId: String(object.id || '') },
  };
  if (event.type === 'checkout.session.completed') {
    base.type = 'checkout.completed';
    base.status = 'active';
  } else if (event.type.startsWith('customer.subscription.')) {
    base.type = event.type.endsWith('.deleted')
      ? 'subscription.deleted'
      : event.type.replace('customer.', '');
    base.status = event.type.endsWith('.deleted') ? 'canceled' : subscriptionStatus(object.status);
  } else if (event.type === 'invoice.paid' || event.type === 'invoice.payment_failed') {
    base.type = event.type;
    base.status = event.type === 'invoice.paid' ? 'active' : 'past_due';
    base.invoice = {
      invoiceId: String(object.id),
      status: event.type === 'invoice.paid' ? 'paid' : 'open',
      amountCents: Math.max(0, Number(object.amount_paid || object.amount_due || 0)),
      currency: String(object.currency || 'usd').toUpperCase(),
      hostedUrl: object.hosted_invoice_url || undefined,
      issuedAt: unixDate(object.created),
      dueAt: unixDate(object.due_date),
      paidAt:
        event.type === 'invoice.paid'
          ? unixDate(object.status_transitions?.paid_at || object.created)
          : undefined,
    };
  } else if (event.type === 'charge.refunded' || event.type === 'charge.dispute.created') {
    base.type = event.type === 'charge.refunded' ? 'payment.refunded' : 'payment.chargeback';
    base.status = event.type === 'charge.refunded' ? 'active' : 'past_due';
    base.transaction = {
      transactionId: String(object.id),
      type: event.type === 'charge.refunded' ? 'refund' : 'chargeback',
      status: 'succeeded',
      amountCents: Math.max(0, Number(object.amount_refunded || object.amount || 0)),
      currency: String(object.currency || 'usd').toUpperCase(),
      processedAt: unixDate(object.created),
    };
  } else {
    throw new HttpError('Stripe 事件类型未支持', 400, 'BILLING_EVENT_UNSUPPORTED');
  }
  if (!base.eventId) throw new HttpError('Stripe 事件缺少 event id', 400, 'BILLING_EVENT_INVALID');
  return base;
}
