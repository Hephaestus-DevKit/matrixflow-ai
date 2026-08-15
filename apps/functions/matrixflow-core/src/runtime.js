import { Client, ID, Permission, Query, Role, Storage, TablesDB, Teams } from 'node-appwrite';

export const DATABASE_ID = process.env.MATRIXFLOW_DATABASE_ID || 'matrixflow';
export const BUCKET_ID = process.env.MATRIXFLOW_KNOWLEDGE_BUCKET_ID || 'knowledge-files';
export const PAGE_SIZE = 100;

export const TABLES = {
  agents: 'agents',
  agentRuns: 'agent_runs',
  contentProjects: 'content_projects',
  contentItems: 'content_items',
  knowledgeBases: 'knowledge_bases',
  knowledgeDocuments: 'knowledge_documents',
  workflows: 'workflows',
  workflowVersions: 'workflow_versions',
  workflowRuns: 'workflow_runs',
  customers: 'customers',
  leads: 'leads',
  conversations: 'conversations',
  messages: 'messages',
  usageRecords: 'usage_records',
  auditLogs: 'audit_logs',
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
  if (req.bodyJson && typeof req.bodyJson === 'object') {
    let serialized;
    try {
      serialized = JSON.stringify(req.bodyJson);
    } catch {
      throw new HttpError('请求内容不是有效 JSON', 400, 'INVALID_JSON');
    }
    if (Buffer.byteLength(serialized) > 128 * 1024)
      throw new HttpError('请求内容过大', 413, 'BODY_TOO_LARGE');
    return req.bodyJson;
  }
  const text = typeof req.bodyText === 'string' ? req.bodyText : '';
  if (Buffer.byteLength(text) > 128 * 1024)
    throw new HttpError('请求内容过大', 413, 'BODY_TOO_LARGE');
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    throw new HttpError('请求内容不是有效 JSON', 400, 'INVALID_JSON');
  }
}

export function serverClient(req) {
  const key = req.headers['x-appwrite-key'];
  if (!key) throw new HttpError('函数运行凭证缺失', 500, 'FUNCTION_KEY_MISSING');
  const client = new Client()
    .setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT)
    .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
    .setKey(key);
  return { tables: new TablesDB(client), teams: new Teams(client), storage: new Storage(client) };
}

export function rowPermissions(teamId) {
  // Browser clients can read team rows directly, but every write must pass
  // through the Function's capability and schema checks.
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
  const members = await services.teams.listMemberships({
    teamId,
    queries: [Query.equal('userId', userId), Query.limit(1)],
  });
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
      permissions: rowPermissions(teamId),
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
  for (let offset = 0; offset < 2_000; offset += PAGE_SIZE) {
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
    rows.push(...result.rows.map(decodeRow));
    if (result.rows.length < PAGE_SIZE || rows.length >= result.total) break;
  }
  return rows;
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
  const records = [
    ['ai_call', 1],
    ['token_input', generated.usage.inputTokens],
    ['token_output', generated.usage.outputTokens],
  ];
  await Promise.all(
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
