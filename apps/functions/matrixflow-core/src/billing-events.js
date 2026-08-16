import { Query } from 'node-appwrite';
import { billingSignature, isValidBillingSignature } from './billing.js';
import { isValidStripeSignature, normalizeStripeEvent } from './billing-provider.js';
import { HttpError, TABLES, createRow, listRows, serverClient, updateOwned } from './runtime.js';
import { parse, schemas } from './schemas.js';

export async function handleBillingWebhook({ req, res, services: providedServices }) {
  const secret = process.env.MATRIXFLOW_BILLING_WEBHOOK_SECRET;
  const rawBody =
    typeof req.bodyText === 'string'
      ? req.bodyText
      : JSON.stringify(req.bodyJson && typeof req.bodyJson === 'object' ? req.bodyJson : {});
  const signature =
    req.headers['x-matrixflow-billing-signature'] || req.headers['x-billing-signature'] || '';
  if (!isValidBillingSignature(rawBody, signature, secret))
    throw new HttpError('计费事件签名无效', 401, 'BILLING_SIGNATURE_INVALID');
  let body;
  try {
    body = JSON.parse(rawBody || '{}');
  } catch {
    throw new HttpError('计费事件不是有效 JSON', 400, 'INVALID_JSON');
  }
  const input = parse(schemas.billingWebhook, body);
  const services = providedServices || serverClient(req);
  try {
    await services.teams.get({ teamId: input.organizationId });
  } catch (error) {
    if (Number(error?.status || error?.code) === 404)
      throw new HttpError('计费事件的团队空间不存在', 404, 'ORGANIZATION_NOT_FOUND');
    throw error;
  }
  const existingEvents = await listRows(services, TABLES.billingEvents, input.organizationId, [
    Query.equal('eventId', input.eventId),
  ]);
  if (existingEvents[0])
    return res.json({ accepted: true, duplicate: true, eventId: input.eventId }, 200);

  const subscriptionsByProviderId = await listRows(
    services,
    TABLES.subscriptions,
    input.organizationId,
    [Query.equal('externalSubscriptionId', input.subscriptionId)],
  );
  const subscriptions =
    subscriptionsByProviderId.length > 0
      ? subscriptionsByProviderId
      : await listRows(services, TABLES.subscriptions, input.organizationId, [Query.limit(1)]);
  const existingSubscription = subscriptions[0];
  const lifecycleEvent =
    input.type === 'checkout.completed' || input.type.startsWith('subscription.');
  if (!existingSubscription && !lifecycleEvent)
    throw new HttpError(
      '计费事件对应的订阅尚未建立，请稍后重试',
      409,
      'BILLING_SUBSCRIPTION_NOT_FOUND',
    );
  // Invoice, refund, and chargeback events may identify an invoice, charge,
  // or dispute rather than the Stripe subscription. They can update billing
  // state, but must never replace a known subscription identity or plan.
  const subscriptionData = lifecycleEvent
    ? {
        planId: input.planId,
        status: input.status,
        provider: input.provider,
        externalSubscriptionId: input.subscriptionId,
        seats: input.seats,
        currentPeriodStart: input.currentPeriodStart,
        currentPeriodEnd: input.currentPeriodEnd,
        metadata: input.metadata,
      }
    : {
        planId: existingSubscription.planId,
        status: input.status,
        provider: existingSubscription.provider,
        externalSubscriptionId: existingSubscription.externalSubscriptionId,
        seats: existingSubscription.seats,
        currentPeriodStart: existingSubscription.currentPeriodStart,
        currentPeriodEnd: existingSubscription.currentPeriodEnd,
        metadata: {
          ...(existingSubscription.metadata || {}),
          ...input.metadata,
        },
      };
  const subscription = existingSubscription
    ? await updateOwned(
        services,
        TABLES.subscriptions,
        existingSubscription.id,
        input.organizationId,
        subscriptionData,
      )
    : await createRow(services, TABLES.subscriptions, input.organizationId, subscriptionData);
  if (input.invoice) {
    const invoices = await listRows(services, TABLES.billingInvoices, input.organizationId, [
      Query.equal('externalInvoiceId', input.invoice.invoiceId),
    ]);
    const invoiceData = {
      provider: input.provider,
      externalInvoiceId: input.invoice.invoiceId,
      subscriptionId: subscription.externalSubscriptionId,
      status: input.invoice.status,
      amountCents: input.invoice.amountCents,
      currency: input.invoice.currency.toUpperCase(),
      hostedUrl: input.invoice.hostedUrl,
      issuedAt: input.invoice.issuedAt,
      dueAt: input.invoice.dueAt,
      paidAt: input.invoice.paidAt,
      metadata: input.metadata,
    };
    if (invoices[0])
      await updateOwned(
        services,
        TABLES.billingInvoices,
        invoices[0].id,
        input.organizationId,
        invoiceData,
      );
    else await createRow(services, TABLES.billingInvoices, input.organizationId, invoiceData);
  }
  if (input.transaction) {
    const transactions = await listRows(
      services,
      TABLES.billingTransactions,
      input.organizationId,
      [Query.equal('externalTransactionId', input.transaction.transactionId)],
    );
    const transactionData = {
      provider: input.provider,
      externalTransactionId: input.transaction.transactionId,
      subscriptionId: subscription.externalSubscriptionId,
      type: input.transaction.type,
      status: input.transaction.status,
      amountCents: input.transaction.amountCents,
      currency: input.transaction.currency.toUpperCase(),
      processedAt: input.transaction.processedAt || new Date().toISOString(),
      metadata: input.metadata,
    };
    if (transactions[0])
      await updateOwned(
        services,
        TABLES.billingTransactions,
        transactions[0].id,
        input.organizationId,
        transactionData,
      );
    else
      await createRow(services, TABLES.billingTransactions, input.organizationId, transactionData);
  }
  try {
    await createRow(services, TABLES.billingEvents, input.organizationId, {
      eventId: input.eventId,
      provider: input.provider,
      type: input.type,
      subscriptionId: subscription.externalSubscriptionId,
      payload: input.metadata,
      processedAt: new Date().toISOString(),
    });
  } catch (error) {
    if (Number(error?.status || error?.code) !== 409) throw error;
    return res.json({ accepted: true, duplicate: true, eventId: input.eventId }, 200);
  }
  return res.json(
    { accepted: true, duplicate: false, eventId: input.eventId, subscriptionId: subscription.id },
    200,
  );
}

export async function handleStripeWebhook({ req, res }) {
  const rawBody =
    typeof req.bodyText === 'string'
      ? req.bodyText
      : JSON.stringify(req.bodyJson && typeof req.bodyJson === 'object' ? req.bodyJson : {});
  const signature = req.headers['stripe-signature'] || '';
  if (!isValidStripeSignature(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET))
    throw new HttpError('Stripe 事件签名无效', 401, 'BILLING_SIGNATURE_INVALID');
  let event;
  try {
    event = JSON.parse(rawBody || '{}');
  } catch {
    throw new HttpError('Stripe 事件不是有效 JSON', 400, 'INVALID_JSON');
  }
  const normalized = normalizeStripeEvent(event);
  const normalizedBody = JSON.stringify(normalized);
  const internalSecret = process.env.MATRIXFLOW_BILLING_WEBHOOK_SECRET;
  if (!internalSecret)
    throw new HttpError('计费规范化密钥尚未配置', 503, 'BILLING_WEBHOOK_NOT_CONFIGURED');
  return handleBillingWebhook({
    req: {
      ...req,
      bodyText: normalizedBody,
      bodyJson: undefined,
      headers: {
        ...req.headers,
        'x-matrixflow-billing-signature': billingSignature(normalizedBody, internalSecret),
      },
    },
    res,
  });
}
