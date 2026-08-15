import { Client, ID, Permission, Query, Role, Storage, TablesDB, Teams } from 'node-appwrite';

export const DATABASE_ID = process.env.MATRIXFLOW_DATABASE_ID || 'matrixflow';
export const BUCKET_ID = process.env.MATRIXFLOW_KNOWLEDGE_BUCKET_ID || 'knowledge-files';
export const PAGE_SIZE = 100;
const MAX_LIST_ROWS = 10_000;
const MAX_REQUEST_BODY_BYTES = 128 * 1024;

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
  auditLogs: 'audit_logs',
  billingRequests: 'billing_requests',
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
  return { tables: new TablesDB(client), teams: new Teams(client), storage: new Storage(client) };
}

const FUNCTION_ONLY_TABLES = new Set([
  TABLES.auditLogs,
  TABLES.usageRecords,
  TABLES.billingRequests,
  'idempotency_keys',
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
  const elevated = membership.roles.includes('owner') || membership.roles.includes('admin');
  if (!elevated && !MEMBER_CAPABILITIES.has(capability))
    throw new HttpError('当前团队角色无权执行此操作', 403, 'INSUFFICIENT_ROLE');
}

export function requireAdmin(membership) {
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
  const rows = await listRows(services, 'idempotency_keys', teamId, [Query.equal('key', key)]);
  return rows[0] || null;
}

export async function saveIdempotency(services, teamId, data) {
  return createRow(services, 'idempotency_keys', teamId, data);
}

export async function deleteIdempotency(services, teamId, rowId) {
  return deleteOwned(services, 'idempotency_keys', rowId, teamId);
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
  const records = [
    ['ai_call', 1],
    ['token_input', safeInputTokens],
    ['token_output', safeOutputTokens],
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
        },
        recordedAt: new Date().toISOString(),
      }),
    ),
  );
  const failed = results.find((result) => result.status === 'rejected');
  if (failed?.status === 'rejected') throw failed.reason;
}

async function usageCountSince(services, teamId, since) {
  const result = await services.tables.listRows({
    databaseId: DATABASE_ID,
    tableId: TABLES.usageRecords,
    queries: [
      Query.equal('organizationId', teamId),
      Query.equal('metric', 'ai_call'),
      Query.greaterThanEqual('recordedAt', since),
      Query.limit(1),
    ],
  });
  return result.total;
}

export async function enforceAiBudget(services, teamId, requestedCalls = 1) {
  const monthlyLimit = Math.max(1, Number(process.env.MATRIXFLOW_AI_MONTHLY_LIMIT || 100));
  const perMinuteLimit = Math.max(1, Number(process.env.MATRIXFLOW_AI_PER_MINUTE_LIMIT || 20));
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  const minuteStart = new Date(now.getTime() - 60_000).toISOString();
  const [monthly, recent] = await Promise.all([
    usageCountSince(services, teamId, monthStart),
    usageCountSince(services, teamId, minuteStart),
  ]);
  if (monthly + requestedCalls > monthlyLimit)
    throw new HttpError('本月 AI 调用额度已用完', 429, 'AI_MONTHLY_QUOTA_EXCEEDED', {
      limit: monthlyLimit,
      used: monthly,
    });
  if (recent + requestedCalls > perMinuteLimit)
    throw new HttpError('AI 请求过于频繁，请稍后再试', 429, 'AI_RATE_LIMITED', {
      limit: perMinuteLimit,
    });
  return { monthlyLimit, monthlyUsed: monthly, remaining: monthlyLimit - monthly };
}
