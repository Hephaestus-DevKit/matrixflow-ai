import test from 'node:test';
import assert from 'node:assert/strict';
import { billingSignature } from '../src/billing.js';
import { handleBillingWebhook } from '../src/billing-events.js';

test('financial webhooks preserve the existing subscription identity during reconciliation', async () => {
  const previousSecret = process.env.MATRIXFLOW_BILLING_WEBHOOK_SECRET;
  process.env.MATRIXFLOW_BILLING_WEBHOOK_SECRET = 'billing-test-secret';
  const writes = [];
  let subscriptionLists = 0;
  const existingSubscription = {
    $id: 'subscription-row-1',
    organizationId: 'team-1',
    planId: 'pro',
    status: 'active',
    provider: 'stripe',
    externalSubscriptionId: 'sub_real_1',
    seats: 5,
    metadata: '{}',
  };
  const services = {
    teams: { get: async () => ({ $id: 'team-1' }) },
    tables: {
      listRows: async ({ tableId }) => {
        if (tableId === 'subscriptions') {
          subscriptionLists += 1;
          return subscriptionLists === 1
            ? { total: 0, rows: [] }
            : { total: 1, rows: [existingSubscription] };
        }
        return { total: 0, rows: [] };
      },
      getRow: async ({ rowId }) => ({ ...existingSubscription, $id: rowId }),
      updateRow: async (input) => {
        writes.push(input);
        return { ...existingSubscription, $id: input.rowId, ...input.data };
      },
      createRow: async (input) => {
        writes.push(input);
        return { $id: input.rowId, ...input.data };
      },
    },
  };
  const body = {
    eventId: 'evt_invoice_1',
    organizationId: 'team-1',
    provider: 'stripe',
    type: 'invoice.paid',
    // This can be an invoice-like identifier in third-party adapters. It must
    // never overwrite the already verified subscription identity.
    subscriptionId: 'in_1',
    planId: 'free',
    status: 'active',
    seats: 1,
    metadata: { stripeEventType: 'invoice.paid' },
    invoice: {
      invoiceId: 'in_1',
      status: 'paid',
      amountCents: 2500,
      currency: 'USD',
    },
  };
  const rawBody = JSON.stringify(body);
  const req = {
    bodyText: rawBody,
    headers: {
      'x-matrixflow-billing-signature': billingSignature(rawBody, 'billing-test-secret'),
    },
  };
  const res = { json: (value, status) => ({ value, status }) };
  try {
    const response = await handleBillingWebhook({ req, res, services });
    assert.equal(response.status, 200);
    const subscriptionWrite = writes.find((write) => write.tableId === 'subscriptions');
    const invoiceWrite = writes.find((write) => write.tableId === 'billing_invoices');
    const eventWrite = writes.find((write) => write.tableId === 'billing_events');
    assert.equal(subscriptionWrite.data.externalSubscriptionId, 'sub_real_1');
    assert.equal(subscriptionWrite.data.planId, 'pro');
    assert.equal(invoiceWrite.data.subscriptionId, 'sub_real_1');
    assert.equal(eventWrite.data.subscriptionId, 'sub_real_1');
  } finally {
    if (previousSecret === undefined) delete process.env.MATRIXFLOW_BILLING_WEBHOOK_SECRET;
    else process.env.MATRIXFLOW_BILLING_WEBHOOK_SECRET = previousSecret;
  }
});
