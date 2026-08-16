import { Query } from 'node-appwrite';
import {
  HttpError,
  TABLES,
  createRow,
  getTeamPlan,
  listRows,
  recordAudit,
  requireAdmin,
  requireCapability,
} from '../runtime.js';
import { parse, schemas } from '../schemas.js';
import { planById, publicPlanCatalog } from '../plans.js';
import { billingProviderReadiness, createCheckoutSession } from '../billing-provider.js';

const SUBSCRIPTION_PRIORITY = Object.freeze({
  active: 7,
  trialing: 6,
  past_due: 5,
  unpaid: 4,
  paused: 3,
  incomplete: 2,
  canceled: 1,
});

export function selectCurrentSubscription(subscriptions, now = Date.now()) {
  return [...subscriptions]
    .filter((row) => {
      if (row.status === 'canceled') return true;
      const end = row.currentPeriodEnd ? new Date(row.currentPeriodEnd).getTime() : 0;
      return (
        !end || end > now || ['past_due', 'unpaid', 'paused', 'incomplete'].includes(row.status)
      );
    })
    .sort((a, b) => {
      const priority =
        Number(SUBSCRIPTION_PRIORITY[b.status] || 0) - Number(SUBSCRIPTION_PRIORITY[a.status] || 0);
      if (priority) return priority;
      return String(b.currentPeriodEnd || '').localeCompare(String(a.currentPeriodEnd || ''));
    })[0];
}

async function currentSubscription(services, teamId) {
  const subscriptions = await listRows(services, TABLES.subscriptions, teamId).catch((error) => {
    if (Number(error?.status || error?.code) === 404) return [];
    throw error;
  });
  return selectCurrentSubscription(subscriptions);
}

async function usageResponse(services, teamId, now, monthStart, summary, byProvider, byModel) {
  const plan = await getTeamPlan(services, teamId);
  const counterBucket = `month:${now.toISOString().slice(0, 7)}`;
  const counters = await listRows(services, TABLES.usageCounters, teamId, [
    Query.equal('bucket', counterBucket),
    Query.limit(1),
  ]).catch((error) => {
    if (Number(error?.status || error?.code) === 404) return [];
    throw error;
  });
  const reservedAiCalls = Number(counters[0]?.used || 0);
  return {
    ...summary,
    meta: {
      periodStart: monthStart.toISOString(),
      periodEnd: now.toISOString(),
      plan: plan.id,
      limits: {
        aiCallsPerMonth: plan.aiCallsPerMonth,
        aiCallsPerMinute: plan.aiCallsPerMinute,
      },
      reservedAiCalls,
      byProvider,
      byModel,
      estimatedCostUsd: Number(summary.ai_cost_cents || 0) / 100,
    },
  };
}

async function usageSummary(services, teamId) {
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const period = now.toISOString().slice(0, 7);
  const aggregates = await listRows(services, TABLES.usageAggregates, teamId, [
    Query.equal('period', period),
  ]).catch((error) => {
    if (Number(error?.status || error?.code) === 404) return [];
    throw error;
  });
  if (aggregates.length > 0) {
    const summary = {};
    const byProvider = {};
    const byModel = {};
    for (const row of aggregates) {
      const value = Number(row.value || 0);
      if (row.dimensionType === 'total') summary[row.metric] = (summary[row.metric] || 0) + value;
      if (row.metric === 'ai_call' && row.dimensionType === 'provider')
        byProvider[row.dimensionValue] = value;
      if (row.metric === 'ai_call' && row.dimensionType === 'model')
        byModel[row.dimensionValue] = value;
    }
    return usageResponse(services, teamId, now, monthStart, summary, byProvider, byModel);
  }

  const records = await listRows(services, TABLES.usageRecords, teamId, [
    Query.greaterThanEqual('recordedAt', monthStart.toISOString()),
  ]);
  const summary = records.reduce((total, row) => {
    const metric = String(row.metric);
    total[metric] = (total[metric] || 0) + Number(row.value || 0);
    return total;
  }, {});
  const byProvider = {};
  const byModel = {};
  for (const row of records) {
    const metadata = row.metadata && typeof row.metadata === 'object' ? row.metadata : {};
    const provider = String(metadata.provider || 'unknown');
    const model = String(metadata.model || 'unknown');
    byProvider[provider] =
      (byProvider[provider] || 0) + (row.metric === 'ai_call' ? Number(row.value || 0) : 0);
    byModel[model] =
      (byModel[model] || 0) + (row.metric === 'ai_call' ? Number(row.value || 0) : 0);
  }
  return usageResponse(services, teamId, now, monthStart, summary, byProvider, byModel);
}

async function createUpgradeRequest(services, context, body) {
  const input = parse(schemas.billingRequest, body);
  const pending = await listRows(services, TABLES.billingRequests, context.teamId, [
    Query.equal('requestedPlan', input.requestedPlan),
    Query.equal('status', 'PENDING'),
  ]);
  if (pending[0]) return { request: pending[0], created: false };
  let request;
  try {
    request = await createRow(services, TABLES.billingRequests, context.teamId, {
      requestedPlan: input.requestedPlan,
      requestedSeats: input.requestedSeats,
      status: 'PENDING',
      note: input.note,
      requestedBy: context.userId,
    });
  } catch (error) {
    const status = Number(error?.status || error?.code);
    if (status !== 409) throw error;
    const concurrent = await listRows(services, TABLES.billingRequests, context.teamId, [
      Query.equal('requestedPlan', input.requestedPlan),
      Query.equal('status', 'PENDING'),
    ]);
    if (!concurrent[0]) throw error;
    return { request: concurrent[0], created: false };
  }
  await recordAudit(services, context, 'billing.upgrade_requested', 'billing_request', request.id, {
    requestedPlan: input.requestedPlan,
    requestedSeats: input.requestedSeats,
  });
  return { request, created: true };
}

export async function handleBillingRoute({ services, context, membership, path, method, body }) {
  if (method === 'GET' && path === '/billing/plans') return publicPlanCatalog();
  if (method === 'GET' && path === '/billing/config') return billingProviderReadiness();

  if (method === 'POST' && path === '/billing/checkout') {
    requireAdmin(membership);
    const input = parse(schemas.billingCheckout, body);
    return createCheckoutSession({ ...input, organizationId: context.teamId });
  }

  if (method === 'GET' && path === '/billing/current') {
    requireCapability(membership, 'billing.read');
    const current = await currentSubscription(services, context.teamId);
    const plan = planById(current?.planId || 'free');
    return {
      id: current?.id || 'free-preview',
      status: current?.status || 'preview',
      provider: current?.provider || null,
      seats: current?.seats || plan.seats,
      currentPeriodEnd: current?.currentPeriodEnd || null,
      plan: publicPlanCatalog().find((item) => item.id === plan.id),
    };
  }

  if (method === 'GET' && path === '/billing/requests') {
    requireCapability(membership, 'billing.read');
    return listRows(services, TABLES.billingRequests, context.teamId);
  }

  if (method === 'GET' && path === '/billing/invoices') {
    requireCapability(membership, 'billing.read');
    return listRows(services, TABLES.billingInvoices, context.teamId, [
      Query.orderDesc('issuedAt'),
      Query.limit(100),
    ]);
  }

  if (method === 'GET' && path === '/billing/transactions') {
    requireCapability(membership, 'billing.read');
    return listRows(services, TABLES.billingTransactions, context.teamId, [
      Query.orderDesc('processedAt'),
      Query.limit(100),
    ]);
  }

  if (method === 'GET' && path === '/billing/usage') {
    requireCapability(membership, 'billing.read');
    return usageSummary(services, context.teamId);
  }

  if (method === 'POST' && path === '/billing/requests') {
    requireCapability(membership, 'billing.read');
    return createUpgradeRequest(services, context, body);
  }

  throw new HttpError('函数路由不存在', 404, 'ROUTE_NOT_FOUND');
}
