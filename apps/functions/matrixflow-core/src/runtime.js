import {
  Client,
  Functions,
  ID,
  Permission,
  Query,
  Role,
  Storage,
  TablesDB,
  Teams,
} from 'node-appwrite';
import { createHash } from 'node:crypto';
import { DEFAULT_PLAN_ID, planById } from './plans.js';
import { subscriptionEntitled } from './billing.js';

export const DATABASE_ID = process.env.MATRIXFLOW_DATABASE_ID || 'matrixflow';
export const BUCKET_ID = process.env.MATRIXFLOW_KNOWLEDGE_BUCKET_ID || 'knowledge-files';
export const PAGE_SIZE = 100;
const MAX_LIST_ROWS = 10_000;
const MAX_REQUEST_BODY_BYTES = 128 * 1024;
const COUNTER_CLEANUP_INTERVAL_MS = 5 * 60_000;
const counterCleanupAt = new Map();

export const TABLES = {
  agents: 'agents',
  agentRuns: 'agent_runs',
  contentProjects: 'content_projects',
  contentItems: 'content_items',
  knowledgeBases: 'knowledge_bases',
  knowledgeDocuments: 'knowledge_documents',
  knowledgeChunks: 'knowledge_chunks',
  workflows: 'workflows',
  workflowVersions: 'workflow_versions',
  workflowRuns: 'workflow_runs',
  customers: 'customers',
  leads: 'leads',
  conversations: 'conversations',
  messages: 'messages',
  usageRecords: 'usage_records',
  usageAggregates: 'usage_aggregates',
  usageCounters: 'usage_counters',
  idempotencyKeys: 'idempotency_keys',
  auditLogs: 'audit_logs',
  billingRequests: 'billing_requests',
  subscriptions: 'subscriptions',
  billingEvents: 'billing_events',
  billingInvoices: 'billing_invoices',
  billingTransactions: 'billing_transactions',
  marketplaceItems: 'marketplace_items',
  marketplacePurchases: 'marketplace_purchases',
  marketplaceReviews: 'marketplace_reviews',
  backgroundJobs: 'background_jobs',
  apiKeys: 'api_keys',
};

const JSON_FIELDS = new Set([
  'systemPrompt',
  'skills',
  'configuration',
  'input',
  'output',
  'productData',
  'body',
  'metadata',
  'dsl',
  'logs',
  'payload',
  'result',
  'scopes',
  'tags',
  'notes',
]);

const MEMBER_CAPABILITIES = new Set([
  'agents.manage',
  'content.manage',
  'knowledge.manage',
  'workflows.manage',
  'crm.manage',
  'billing.read',
]);

export class HttpError extends Error {
  constructor(message, status = 400, code = 'BAD_REQUEST', details) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function requestBody(req) {
  if (req.bodyJson !== undefined) {
    if (!req.bodyJson || typeof req.bodyJson !== 'object' || Array.isArray(req.bodyJson))
      throw new HttpError('请求内容必须是 JSON 对象', 400, 'INVALID_JSON');
    let serialized;
    try {
      serialized = JSON.stringify(req.bodyJson);
    } catch {
      throw new HttpError('请求内容不是有效 JSON', 400, 'INVALID_JSON');
    }
    if (Buffer.byteLength(serialized, 'utf8') > MAX_REQUEST_BODY_BYTES)
      throw new HttpError('请求内容过大', 413, 'BODY_TOO_LARGE');
    return req.bodyJson;
  }
  const text = typeof req.bodyText === 'string' ? req.bodyText : '';
  if (Buffer.byteLength(text, 'utf8') > MAX_REQUEST_BODY_BYTES)
    throw new HttpError('请求内容过大', 413, 'BODY_TOO_LARGE');
  let parsed;
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch {
    throw new HttpError('请求内容不是有效 JSON', 400, 'INVALID_JSON');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
    throw new HttpError('请求内容必须是 JSON 对象', 400, 'INVALID_JSON');
  return parsed;
}

export function serverClient(req) {
  const key = req.headers['x-appwrite-key'];
  const endpoint = process.env.APPWRITE_FUNCTION_API_ENDPOINT;
  const projectId = process.env.APPWRITE_FUNCTION_PROJECT_ID;
  if (!key) throw new HttpError('函数运行凭证缺失', 500, 'FUNCTION_KEY_MISSING');
  if (!endpoint || !projectId)
    throw new HttpError('函数运行环境未正确配置', 500, 'FUNCTION_CONFIG_MISSING');
  const client = new Client().setEndpoint(endpoint).setProject(projectId).setKey(key);
  return {
    tables: new TablesDB(client),
    teams: new Teams(client),
    storage: new Storage(client),
    functions: new Functions(client),
  };
}

const FUNCTION_ONLY_TABLES = new Set([
  TABLES.auditLogs,
  TABLES.usageRecords,
  TABLES.usageAggregates,
  TABLES.usageCounters,
  TABLES.billingRequests,
  TABLES.idempotencyKeys,
  TABLES.subscriptions,
  TABLES.billingEvents,
  TABLES.billingInvoices,
  TABLES.billingTransactions,
  TABLES.marketplacePurchases,
  TABLES.marketplaceReviews,
  TABLES.backgroundJobs,
  TABLES.apiKeys,
]);

export function rowPermissions(teamId, tableId) {
  // Keep ordinary workspace rows readable by team members for fast, cached
  // dashboards. Sensitive operational and billing data is Function-only.
  if (FUNCTION_ONLY_TABLES.has(tableId)) return [];
  return [Permission.read(Role.team(teamId))];
}

export function encodeData(data) {
  return Object.fromEntries(
    Object.entries(data)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [
        key,
        JSON_FIELDS.has(key) && typeof value !== 'string' ? JSON.stringify(value) : value,
      ]),
  );
}

export function decodeRow(row) {
  const result = { id: row.$id, createdAt: row.$createdAt, updatedAt: row.$updatedAt };
  for (const [key, value] of Object.entries(row)) {
    if (key.startsWith('$')) continue;
    if (JSON_FIELDS.has(key) && typeof value === 'string') {
      try {
        result[key] = JSON.parse(value);
      } catch {
        result[key] = value;
      }
    } else result[key] = value;
  }
  return result;
}

export async function requireTeamMember(services, teamId, userId) {
  if (typeof teamId !== 'string' || !teamId)
    throw new HttpError('缺少团队空间', 400, 'ORGANIZATION_REQUIRED');
  let members;
  try {
    members = await services.teams.listMemberships({
      teamId,
      queries: [Query.equal('userId', userId), Query.limit(1)],
    });
  } catch (error) {
    const status = Number(error?.status || error?.code);
    if (status === 401 || status === 403 || status === 404)
      throw new HttpError('无权访问该团队空间', 403, 'FORBIDDEN');
    throw error;
  }
  const membership = members.memberships[0];
  if (!membership) throw new HttpError('无权访问该团队空间', 403, 'FORBIDDEN');
  return { ...membership, roles: membership.roles?.length ? membership.roles : ['member'] };
}

export function requireCapability(membership, capability) {
  if (membership.source === 'api-key') {
    if (!membership.capabilities?.includes(capability))
      throw new HttpError('当前 API Key 无权执行此操作', 403, 'API_KEY_SCOPE_REQUIRED');
    return;
  }
  const elevated = membership.roles.includes('owner') || membership.roles.includes('admin');
  if (!elevated && !MEMBER_CAPABILITIES.has(capability))
    throw new HttpError('当前团队角色无权执行此操作', 403, 'INSUFFICIENT_ROLE');
}

export function requireAdmin(membership) {
  if (membership.source === 'api-key')
    throw new HttpError('API Key 不能执行管理员操作', 403, 'ADMIN_REQUIRED');
  if (!membership.roles.includes('owner') && !membership.roles.includes('admin'))
    throw new HttpError('仅团队管理员可以执行此操作', 403, 'ADMIN_REQUIRED');
}

export async function getOwned(services, tableId, rowId, teamId, field = 'organizationId') {
  let rawRow;
  try {
    rawRow = await services.tables.getRow({ databaseId: DATABASE_ID, tableId, rowId });
  } catch (error) {
    const status = Number(error?.status || error?.code);
    if (status === 404) throw new HttpError('资源不存在', 404, 'RESOURCE_NOT_FOUND');
    if (status === 401 || status === 403) throw new HttpError('无权访问该资源', 403, 'FORBIDDEN');
    throw error;
  }
  const row = decodeRow(rawRow);
  if (row[field] !== teamId) throw new HttpError('无权访问该资源', 403, 'FORBIDDEN');
  return row;
}

export async function createRow(services, tableId, teamId, data, field = 'organizationId') {
  return decodeRow(
    await services.tables.createRow({
      databaseId: DATABASE_ID,
      tableId,
      rowId: ID.unique(),
      data: encodeData({ ...data, [field]: teamId }),
      permissions: rowPermissions(teamId, tableId),
    }),
  );
}

export async function updateOwned(
  services,
  tableId,
  rowId,
  teamId,
  data,
  field = 'organizationId',
) {
  await getOwned(services, tableId, rowId, teamId, field);
  if (Object.hasOwn(data, field) && data[field] !== undefined && data[field] !== teamId)
    throw new HttpError('资源所属团队不可修改', 400, 'ORGANIZATION_IMMUTABLE');
  return decodeRow(
    await services.tables.updateRow({
      databaseId: DATABASE_ID,
      tableId,
      rowId,
      data: encodeData(data),
    }),
  );
}

export async function deleteOwned(services, tableId, rowId, teamId, field = 'organizationId') {
  const row = await getOwned(services, tableId, rowId, teamId, field);
  await services.tables.deleteRow({ databaseId: DATABASE_ID, tableId, rowId });
  return row;
}

export async function listRows(services, tableId, teamId, queries = [], field = 'organizationId') {
  const rows = [];
  let total = 0;
  for (let offset = 0; offset < MAX_LIST_ROWS; offset += PAGE_SIZE) {
    const result = await services.tables.listRows({
      databaseId: DATABASE_ID,
      tableId,
      queries: [
        Query.equal(field, teamId),
        ...queries,
        Query.limit(PAGE_SIZE),
        Query.offset(offset),
      ],
    });
    total = result.total;
    rows.push(...result.rows.map(decodeRow));
    if (result.rows.length < PAGE_SIZE || rows.length >= result.total) break;
  }
  if (rows.length >= MAX_LIST_ROWS && total > MAX_LIST_ROWS)
    throw new HttpError('资源数量超过单次可处理上限，请缩小查询范围', 413, 'LIST_TOO_LARGE');
  return rows;
}

export async function countRows(services, tableId, teamId, queries = [], field = 'organizationId') {
  const result = await services.tables.listRows({
    databaseId: DATABASE_ID,
    tableId,
    queries: [Query.equal(field, teamId), ...queries, Query.limit(1)],
  });
  return Number(result.total || 0);
}

export async function findIdempotency(services, teamId, key) {
  const rows = await listRows(services, TABLES.idempotencyKeys, teamId, [Query.equal('key', key)]);
  return rows[0] || null;
}

export async function saveIdempotency(services, teamId, data) {
  return createRow(services, TABLES.idempotencyKeys, teamId, data);
}

export async function deleteIdempotency(services, teamId, rowId) {
  return deleteOwned(services, TABLES.idempotencyKeys, rowId, teamId);
}

export async function enforceResourceLimit(
  services,
  tableId,
  teamId,
  limit,
  queries = [],
  label = '资源',
) {
  const safeLimit = Math.max(1, Math.floor(Number(limit)));
  const current = await countRows(services, tableId, teamId, queries);
  if (current >= safeLimit) {
    throw new HttpError(`${label}数量已达到当前套餐上限`, 403, 'PLAN_LIMIT_EXCEEDED', {
      tableId,
      limit: safeLimit,
      used: current,
    });
  }
  return { limit: safeLimit, used: current, remaining: safeLimit - current };
}

function isMissingTable(error) {
  return Number(error?.status || error?.code) === 404;
}

/**
 * Resolve the active subscription without trusting browser-provided plan data.
 * A missing table is treated as the safe Free preview fallback during a
 * rolling deployment; all other storage errors are surfaced so entitlement
 * checks cannot silently fail open.
 */
export async function getTeamPlan(services, teamId) {
  const freeWithOperatorLimits = () => ({
    ...planById(DEFAULT_PLAN_ID),
    aiCallsPerMonth: Number(process.env.MATRIXFLOW_AI_MONTHLY_LIMIT || 100),
    aiCallsPerMinute: Number(process.env.MATRIXFLOW_AI_PER_MINUTE_LIMIT || 20),
    agentLimit: Number(process.env.MATRIXFLOW_AGENT_LIMIT || 10),
    contentProjectLimit: Number(process.env.MATRIXFLOW_CONTENT_PROJECT_LIMIT || 10),
    knowledgeBaseLimit: Number(process.env.MATRIXFLOW_KNOWLEDGE_BASE_LIMIT || 5),
    workflowLimit: Number(process.env.MATRIXFLOW_WORKFLOW_LIMIT || 3),
  });
  let subscriptions;
  try {
    subscriptions = await listRows(services, TABLES.subscriptions, teamId);
  } catch (error) {
    if (!isMissingTable(error)) throw error;
    return freeWithOperatorLimits();
  }
  const current = subscriptions
    .filter((row) => {
      return subscriptionEntitled(row);
    })
    .sort((a, b) =>
      String(b.currentPeriodEnd || '').localeCompare(String(a.currentPeriodEnd || '')),
    )[0];
  return current ? planById(current.planId) : freeWithOperatorLimits();
}

export async function enforcePlanResourceLimit(
  services,
  teamId,
  resource,
  fallbackLimit,
  label,
  queries = [],
) {
  const plan = await getTeamPlan(services, teamId);
  const limit = Number.isFinite(Number(plan[resource])) ? plan[resource] : fallbackLimit;
  const tableByResource = {
    agentLimit: TABLES.agents,
    contentProjectLimit: TABLES.contentProjects,
    knowledgeBaseLimit: TABLES.knowledgeBases,
    workflowLimit: TABLES.workflows,
  };
  const tableId = tableByResource[resource];
  if (!tableId) throw new HttpError('套餐资源限制配置无效', 500, 'PLAN_LIMIT_CONFIG_INVALID');
  return enforceResourceLimit(services, tableId, teamId, limit, queries, label);
}

/**
 * Reserve a plan-scoped resource slot atomically. Counting rows alone is a
 * read/modify/write race: two concurrent creates can both observe the same
 * count and exceed the entitlement. The durable counter is initialized from
 * the current count, then incremented with Appwrite's conditional maximum.
 */
export async function reservePlanResourceLimit(
  services,
  teamId,
  resource,
  fallbackLimit,
  label,
  queries = [],
) {
  const plan = await getTeamPlan(services, teamId);
  const limit = Math.max(
    1,
    Math.floor(Number.isFinite(Number(plan[resource])) ? Number(plan[resource]) : fallbackLimit),
  );
  const tableByResource = {
    agentLimit: TABLES.agents,
    contentProjectLimit: TABLES.contentProjects,
    knowledgeBaseLimit: TABLES.knowledgeBases,
    workflowLimit: TABLES.workflows,
  };
  const tableId = tableByResource[resource];
  if (!tableId) throw new HttpError('套餐资源限制配置无效', 500, 'PLAN_LIMIT_CONFIG_INVALID');
  const current = await countRows(services, tableId, teamId, queries);
  if (current >= limit) {
    throw new HttpError(`${label}数量已达到当前套餐上限`, 403, 'PLAN_LIMIT_EXCEEDED', {
      tableId,
      limit,
      used: current,
    });
  }

  const bucket = `resource:${resource}`;
  const rowId = usageCounterId(teamId, bucket);
  const expiresAt = '9999-12-31T23:59:59.000Z';
  try {
    await services.tables.createRow({
      databaseId: DATABASE_ID,
      tableId: TABLES.usageCounters,
      rowId,
      data: encodeData({
        organizationId: teamId,
        bucket,
        used: current + 1,
        limit,
        expiresAt,
      }),
      permissions: rowPermissions(teamId, TABLES.usageCounters),
    });
  } catch (error) {
    if (Number(error?.status || error?.code) !== 409) throw error;
    try {
      await services.tables.incrementRowColumn({
        databaseId: DATABASE_ID,
        tableId: TABLES.usageCounters,
        rowId,
        column: 'used',
        value: 1,
        max: limit,
      });
    } catch (incrementError) {
      if (!counterLimitReached(incrementError)) throw incrementError;
      throw new HttpError(`${label}数量已达到当前套餐上限`, 403, 'PLAN_LIMIT_EXCEEDED', {
        tableId,
        limit,
      });
    }
  }
  return { resource, bucket, limit, used: current + 1 };
}

export async function releasePlanResourceLimit(services, teamId, reservation) {
  if (!reservation?.bucket) return false;
  const rowId = usageCounterId(teamId, reservation.bucket);
  try {
    await services.tables.decrementRowColumn({
      databaseId: DATABASE_ID,
      tableId: TABLES.usageCounters,
      rowId,
      column: 'used',
      value: 1,
      min: 0,
    });
    return true;
  } catch (error) {
    if (Number(error?.status || error?.code) === 404) return false;
    throw error;
  }
}

export async function recordAudit(services, context, action, resource, resourceId, metadata = {}) {
  return createRow(services, TABLES.auditLogs, context.teamId, {
    userId: context.userId,
    action,
    resource,
    resourceId,
    metadata,
  });
}

export async function recordUsage(services, teamId, generated) {
  const safeInputTokens = Number.isFinite(Number(generated?.usage?.inputTokens))
    ? Math.max(0, Math.round(Number(generated.usage.inputTokens)))
    : 0;
  const safeOutputTokens = Number.isFinite(Number(generated?.usage?.outputTokens))
    ? Math.max(0, Math.round(Number(generated.usage.outputTokens)))
    : 0;
  const safeCostCents = Number.isFinite(Number(generated?.costUsd))
    ? Math.max(0, Math.round(Number(generated.costUsd) * 100))
    : 0;
  const records = [
    ['ai_call', 1],
    ['token_input', safeInputTokens],
    ['token_output', safeOutputTokens],
    ['ai_cost_cents', safeCostCents],
  ];
  const results = await Promise.allSettled(
    records.map(([metric, value]) =>
      createRow(services, TABLES.usageRecords, teamId, {
        metric,
        value,
        metadata: {
          provider: generated.provider,
          protocol: generated.protocol,
          model: generated.model,
          durationMs: generated.durationMs,
          upstreamRequestId: generated.upstreamRequestId,
          requestId: generated.requestId,
          costUsd: Number.isFinite(Number(generated?.costUsd)) ? Number(generated.costUsd) : 0,
        },
        recordedAt: new Date().toISOString(),
      }),
    ),
  );
  const failed = results.find((result) => result.status === 'rejected');
  if (failed?.status === 'rejected') throw failed.reason;

  const period = new Date().toISOString().slice(0, 7);
  const provider = String(generated?.provider || 'unknown').slice(0, 128);
  const model = String(generated?.model || 'unknown').slice(0, 128);
  const aggregateEntries = [
    { metric: 'ai_call', value: 1, dimensionType: 'total', dimensionValue: 'all' },
    {
      metric: 'token_input',
      value: safeInputTokens,
      dimensionType: 'total',
      dimensionValue: 'all',
    },
    {
      metric: 'token_output',
      value: safeOutputTokens,
      dimensionType: 'total',
      dimensionValue: 'all',
    },
    {
      metric: 'ai_cost_cents',
      value: safeCostCents,
      dimensionType: 'total',
      dimensionValue: 'all',
    },
    { metric: 'ai_call', value: 1, dimensionType: 'provider', dimensionValue: provider },
    { metric: 'ai_call', value: 1, dimensionType: 'model', dimensionValue: model },
  ].filter((entry) => entry.value > 0);
  // Aggregates are an analytics acceleration layer. Raw usage rows remain the
  // audit source, so a rolling deployment or a transient aggregate write
  // failure must not turn a successful AI request into a duplicate retry.
  await Promise.allSettled(
    aggregateEntries.map((entry) => incrementUsageAggregate(services, teamId, period, entry)),
  );
}

function usageAggregateId(teamId, period, metric, dimensionType, dimensionValue) {
  return createHash('sha256')
    .update(`${teamId}:${period}:${metric}:${dimensionType}:${dimensionValue}`, 'utf8')
    .digest('hex')
    .slice(0, 32);
}

async function incrementUsageAggregate(
  services,
  teamId,
  period,
  { metric, value, dimensionType, dimensionValue },
) {
  const safeValue = Math.max(1, Math.floor(Number(value)));
  const rowId = usageAggregateId(teamId, period, metric, dimensionType, dimensionValue);
  try {
    await services.tables.createRow({
      databaseId: DATABASE_ID,
      tableId: TABLES.usageAggregates,
      rowId,
      data: encodeData({
        organizationId: teamId,
        period,
        metric,
        dimensionType,
        dimensionValue,
        value: safeValue,
        updatedAt: new Date().toISOString(),
      }),
      permissions: rowPermissions(teamId, TABLES.usageAggregates),
    });
  } catch (error) {
    if (Number(error?.status || error?.code) !== 409) throw error;
    await services.tables.incrementRowColumn({
      databaseId: DATABASE_ID,
      tableId: TABLES.usageAggregates,
      rowId,
      column: 'value',
      value: safeValue,
      max: 1_000_000_000,
    });
    await services.tables
      .updateRow({
        databaseId: DATABASE_ID,
        tableId: TABLES.usageAggregates,
        rowId,
        data: encodeData({ updatedAt: new Date().toISOString() }),
      })
      .catch(() => undefined);
  }
}

function usageCounterId(teamId, bucket) {
  return createHash('sha256').update(`${teamId}:${bucket}`, 'utf8').digest('hex').slice(0, 32);
}

function counterLimitReached(error) {
  const status = Number(error?.status || error?.code);
  return (
    status === 409 ||
    (status === 400 && /max|maximum|limit|range/i.test(String(error?.message || '')))
  );
}

/** Reserve quota with an atomic Appwrite column increment. */
export async function reserveUsageCounter(
  services,
  teamId,
  { bucket, amount, limit, expiresAt, code, message, details = {} },
) {
  const safeAmount = Math.max(1, Math.floor(Number(amount)));
  const safeLimit = Math.max(1, Math.floor(Number(limit)));
  if (safeAmount > safeLimit)
    throw new HttpError(message, 429, code, { ...details, limit: safeLimit });
  const rowId = usageCounterId(teamId, bucket);
  try {
    const created = await services.tables.createRow({
      databaseId: DATABASE_ID,
      tableId: TABLES.usageCounters,
      rowId,
      data: encodeData({
        organizationId: teamId,
        bucket,
        used: safeAmount,
        limit: safeLimit,
        expiresAt,
      }),
      permissions: rowPermissions(teamId, TABLES.usageCounters),
    });
    return decodeRow(created);
  } catch (error) {
    if (Number(error?.status || error?.code) !== 409) throw error;
  }
  try {
    const updated = await services.tables.incrementRowColumn({
      databaseId: DATABASE_ID,
      tableId: TABLES.usageCounters,
      rowId,
      column: 'used',
      value: safeAmount,
      max: safeLimit,
    });
    return decodeRow(updated);
  } catch (error) {
    if (!counterLimitReached(error)) throw error;
    throw new HttpError(message, 429, code, { ...details, limit: safeLimit });
  }
}

async function releaseUsageCounter(services, teamId, bucket, amount) {
  const rowId = usageCounterId(teamId, bucket);
  await services.tables
    .decrementRowColumn({
      databaseId: DATABASE_ID,
      tableId: TABLES.usageCounters,
      rowId,
      column: 'used',
      value: Math.max(1, Math.floor(Number(amount))),
      min: 0,
    })
    .catch(() => undefined);
}

async function cleanupExpiredUsageCounters(services, teamId, now = Date.now()) {
  if (now - Number(counterCleanupAt.get(teamId) || 0) < COUNTER_CLEANUP_INTERVAL_MS) return;
  counterCleanupAt.set(teamId, now);
  try {
    const expired = await services.tables.listRows({
      databaseId: DATABASE_ID,
      tableId: TABLES.usageCounters,
      queries: [
        Query.equal('organizationId', teamId),
        Query.lessThanEqual('expiresAt', new Date(now).toISOString()),
        Query.limit(100),
      ],
    });
    await Promise.allSettled(
      expired.rows.map((row) =>
        services.tables.deleteRow({
          databaseId: DATABASE_ID,
          tableId: TABLES.usageCounters,
          rowId: row.$id,
        }),
      ),
    );
  } catch {
    // Expired counters do not affect correctness because bucket IDs never
    // collide across periods. Cleanup is best-effort and retried later.
  }
}

export async function enforceAiBudget(services, teamId, requestedCalls = 1) {
  const plan = await getTeamPlan(services, teamId);
  const monthlyLimit = Math.max(
    1,
    Number(plan.aiCallsPerMonth || process.env.MATRIXFLOW_AI_MONTHLY_LIMIT || 100),
  );
  const perMinuteLimit = Math.max(
    1,
    Number(plan.aiCallsPerMinute || process.env.MATRIXFLOW_AI_PER_MINUTE_LIMIT || 20),
  );
  const now = new Date();
  const monthBucket = `month:${now.toISOString().slice(0, 7)}`;
  const minuteBucket = `minute:${now.toISOString().slice(0, 16)}`;
  const monthExpiry = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 2, 1),
  ).toISOString();
  const minuteExpiry = new Date(now.getTime() + 10 * 60_000).toISOString();
  const monthly = await reserveUsageCounter(services, teamId, {
    bucket: monthBucket,
    amount: requestedCalls,
    limit: monthlyLimit,
    expiresAt: monthExpiry,
    code: 'AI_MONTHLY_QUOTA_EXCEEDED',
    message: '本月 AI 调用额度已用完',
  });
  try {
    await reserveUsageCounter(services, teamId, {
      bucket: minuteBucket,
      amount: requestedCalls,
      limit: perMinuteLimit,
      expiresAt: minuteExpiry,
      code: 'AI_RATE_LIMITED',
      message: 'AI 请求过于频繁，请稍后再试',
    });
  } catch (error) {
    await releaseUsageCounter(services, teamId, monthBucket, requestedCalls);
    throw error;
  }
  await cleanupExpiredUsageCounters(services, teamId, now.getTime());
  const monthlyUsed = Number(monthly.used || requestedCalls);
  return {
    monthlyLimit,
    monthlyUsed,
    remaining: Math.max(0, monthlyLimit - monthlyUsed),
  };
}

export async function enforceRequestRateLimit(services, teamId, principal, env = process.env) {
  const limit = Math.min(
    10_000,
    Math.max(10, Math.floor(Number(env.MATRIXFLOW_REQUESTS_PER_MINUTE || 120))),
  );
  const now = new Date();
  const principalHash = createHash('sha256')
    .update(String(principal || 'anonymous'), 'utf8')
    .digest('hex')
    .slice(0, 16);
  const counter = await reserveUsageCounter(services, teamId, {
    bucket: `request:${principalHash}:${now.toISOString().slice(0, 16)}`,
    amount: 1,
    limit,
    expiresAt: new Date(now.getTime() + 10 * 60_000).toISOString(),
    code: 'RATE_LIMITED',
    message: '请求过于频繁，请稍后重试',
  });
  await cleanupExpiredUsageCounters(services, teamId, now.getTime());
  return { limit, used: Number(counter.used || 1) };
}
