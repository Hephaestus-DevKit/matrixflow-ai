import { createHmac, timingSafeEqual } from 'node:crypto';

export const SUBSCRIPTION_STATUSES = Object.freeze([
  'trialing',
  'active',
  'past_due',
  'unpaid',
  'paused',
  'canceled',
  'incomplete',
]);

export const BILLING_EVENT_TYPES = Object.freeze([
  'checkout.completed',
  'subscription.created',
  'subscription.updated',
  'subscription.canceled',
  'subscription.deleted',
  'invoice.paid',
  'invoice.payment_failed',
  'payment.refunded',
  'payment.chargeback',
]);

export function subscriptionEntitled(subscription, now = Date.now()) {
  if (!subscription || !['active', 'trialing'].includes(subscription.status)) return false;
  const end = subscription.currentPeriodEnd ? new Date(subscription.currentPeriodEnd).getTime() : 0;
  return !end || end > now;
}

export function billingSignature(rawBody, secret) {
  return createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');
}

export function isValidBillingSignature(rawBody, provided, secret) {
  if (!secret || typeof provided !== 'string') return false;
  const normalized = provided
    .replace(/^sha256=/i, '')
    .trim()
    .toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(normalized)) return false;
  const expected = billingSignature(rawBody, secret);
  return timingSafeEqual(Buffer.from(normalized, 'utf8'), Buffer.from(expected, 'utf8'));
}
