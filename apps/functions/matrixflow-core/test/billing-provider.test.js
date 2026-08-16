import test from 'node:test';
import assert from 'node:assert/strict';
import {
  billingProviderReadiness,
  createCheckoutSession,
  isValidStripeSignature,
  normalizeStripeEvent,
  stripeSignature,
} from '../src/billing-provider.js';

const configured = {
  MATRIXFLOW_BILLING_PROVIDER: 'stripe',
  STRIPE_SECRET_KEY: 'sk_test_secret',
  STRIPE_PRICE_PRO: 'price_pro',
  STRIPE_PRICE_TEAM: 'price_team',
  MATRIXFLOW_BILLING_WEBHOOK_SECRET: 'webhook_secret',
  STRIPE_WEBHOOK_SECRET: 'whsec_test_secret',
  MATRIXFLOW_PUBLIC_URL: 'https://matrixflow-ai.vercel.app',
};

test('billing readiness never reports checkout enabled without all Stripe settings', () => {
  assert.equal(billingProviderReadiness({}).ready, false);
  assert.equal(billingProviderReadiness(configured).ready, true);
  assert.equal(billingProviderReadiness(configured).webhook, true);
  assert.equal(billingProviderReadiness({ ...configured, NODE_ENV: 'production' }).ready, false);
});

test('checkout session validates return origins and sends seat quantity to Stripe', async () => {
  const originalFetch = globalThis.fetch;
  let request;
  globalThis.fetch = async (url, options) => {
    request = { url, options };
    return {
      ok: true,
      status: 200,
      json: async () => ({ id: 'cs_test_1', url: 'https://checkout.stripe.com/c/pay/cs_test_1' }),
    };
  };
  try {
    const result = await createCheckoutSession(
      { planId: 'pro', seats: 5, organizationId: 'team-1' },
      configured,
    );
    assert.deepEqual(result, {
      provider: 'stripe',
      sessionId: 'cs_test_1',
      checkoutUrl: 'https://checkout.stripe.com/c/pay/cs_test_1',
    });
    assert.equal(request.url, 'https://api.stripe.com/v1/checkout/sessions');
    assert.equal(request.options.headers.authorization, 'Bearer sk_test_secret');
    const form = new URLSearchParams(request.options.body);
    assert.equal(form.get('line_items[0][price]'), 'price_pro');
    assert.equal(form.get('line_items[0][quantity]'), '5');
    assert.equal(form.get('metadata[organizationId]'), 'team-1');
  } finally {
    globalThis.fetch = originalFetch;
  }
  await assert.rejects(
    () =>
      createCheckoutSession(
        {
          planId: 'pro',
          seats: 1,
          organizationId: 'team-1',
          successUrl: 'https://evil.example/return',
        },
        configured,
      ),
    (error) => error.code === 'BILLING_RETURN_URL_INVALID',
  );
  await assert.rejects(
    () =>
      createCheckoutSession(
        { planId: 'pro', seats: 1, organizationId: 'team-1' },
        { ...configured, MATRIXFLOW_PUBLIC_URL: 'http://matrixflow-ai.vercel.app' },
      ),
    (error) => error.code === 'BILLING_CONFIG_INVALID',
  );
});

test('checkout fails closed when Stripe is not configured', async () => {
  await assert.rejects(
    () => createCheckoutSession({ planId: 'team', seats: 1, organizationId: 'team-1' }, {}),
    (error) => error.code === 'BILLING_PROVIDER_NOT_CONFIGURED',
  );
});

test('Stripe webhook signatures are timestamp-bound and normalized without raw payload leakage', () => {
  const raw = JSON.stringify({
    id: 'evt_1',
    type: 'customer.subscription.updated',
    data: {
      object: {
        id: 'sub_1',
        status: 'active',
        metadata: { organizationId: 'team-1', planId: 'pro', secret: 'do-not-copy' },
        items: { data: [{ quantity: 3, price: { id: 'price_pro' } }] },
        current_period_start: 1_700_000_000,
        current_period_end: 1_700_100_000,
      },
    },
  });
  const timestamp = Math.floor(Date.now() / 1_000);
  const signature = `t=${timestamp},v1=${stripeSignature(raw, timestamp, 'stripe-secret')}`;
  assert.equal(isValidStripeSignature(raw, signature, 'stripe-secret'), true);
  assert.equal(isValidStripeSignature(raw, signature, 'wrong-secret'), false);
  const normalized = normalizeStripeEvent(JSON.parse(raw), configured);
  assert.deepEqual(
    {
      eventId: normalized.eventId,
      organizationId: normalized.organizationId,
      type: normalized.type,
      planId: normalized.planId,
      status: normalized.status,
      seats: normalized.seats,
    },
    {
      eventId: 'evt_1',
      organizationId: 'team-1',
      type: 'subscription.updated',
      planId: 'pro',
      status: 'active',
      seats: 3,
    },
  );
  assert.equal(normalized.metadata.secret, undefined);
});

test('Stripe invoice events resolve organization and subscription from nested metadata', () => {
  const normalized = normalizeStripeEvent(
    {
      id: 'evt_invoice_1',
      type: 'invoice.paid',
      data: {
        object: {
          id: 'in_1',
          parent: {
            subscription_details: {
              subscription: 'sub_1',
              metadata: { organizationId: 'team-1', planId: 'pro' },
            },
          },
          lines: { data: [{ price: { id: 'price_pro' }, quantity: 4 }] },
          amount_paid: 2500,
          currency: 'usd',
          created: 1_700_000_000,
        },
      },
    },
    configured,
  );
  assert.equal(normalized.organizationId, 'team-1');
  assert.equal(normalized.subscriptionId, 'sub_1');
  assert.equal(normalized.planId, 'pro');
  assert.equal(normalized.invoice.invoiceId, 'in_1');
  assert.equal(normalized.invoice.amountCents, 2500);
});

test('Stripe financial events fail closed without a tenant or subscription mapping', () => {
  assert.throws(
    () =>
      normalizeStripeEvent(
        {
          id: 'evt_refund_1',
          type: 'charge.refunded',
          data: { object: { id: 'ch_1', amount_refunded: 500, currency: 'usd' } },
        },
        configured,
      ),
    (error) => error.code === 'BILLING_EVENT_ORGANIZATION_MISSING',
  );
});
