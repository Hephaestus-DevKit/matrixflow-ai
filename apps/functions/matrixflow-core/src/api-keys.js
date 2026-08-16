import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { Query } from 'node-appwrite';
import { HttpError, TABLES, createRow, getOwned, listRows, updateOwned } from './runtime.js';

export const API_KEY_SCOPES = Object.freeze([
  'agents.manage',
  'content.manage',
  'knowledge.manage',
  'workflows.manage',
  'crm.manage',
  'billing.read',
]);

function hashKey(value) {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function safeMetadata(row) {
  return {
    id: row.id,
    name: row.name,
    keyPrefix: row.keyPrefix,
    scopes: Array.isArray(row.scopes) ? row.scopes : [],
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    lastUsedAt: row.lastUsedAt || null,
    expiresAt: row.expiresAt || null,
    revokedAt: row.revokedAt || null,
    active: !row.revokedAt && (!row.expiresAt || new Date(row.expiresAt).getTime() > Date.now()),
  };
}

export function generateApiKey() {
  const random = randomBytes(32).toString('base64url');
  const secret = `mf_live_${random}`;
  return { secret, keyPrefix: secret.slice(0, 17), keyHash: hashKey(secret) };
}

export function validateApiKeySecret(value) {
  const secret = String(value || '');
  if (!/^mf_live_[A-Za-z0-9_-]{32,}$/.test(secret))
    throw new HttpError('API Key 格式无效', 401, 'API_KEY_INVALID');
  return secret;
}

export async function resolveApiKey(services, teamId, provided) {
  const secret = validateApiKeySecret(provided);
  const prefix = secret.slice(0, 17);
  const rows = await listRows(services, TABLES.apiKeys, teamId, [Query.equal('keyPrefix', prefix)]);
  const candidate = rows[0];
  if (
    !candidate ||
    candidate.organizationId !== teamId ||
    candidate.revokedAt ||
    (candidate.expiresAt && new Date(candidate.expiresAt).getTime() <= Date.now())
  )
    throw new HttpError('API Key 已失效', 401, 'API_KEY_INVALID');
  const actual = Buffer.from(hashKey(secret), 'utf8');
  const expected = Buffer.from(String(candidate.keyHash || ''), 'utf8');
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
    throw new HttpError('API Key 无效', 401, 'API_KEY_INVALID');
  await updateOwned(services, TABLES.apiKeys, candidate.id, teamId, {
    lastUsedAt: new Date().toISOString(),
  }).catch(() => undefined);
  return {
    source: 'api-key',
    roles: ['api'],
    capabilities: Array.isArray(candidate.scopes) ? candidate.scopes : [],
    userId: candidate.createdBy,
    apiKeyId: candidate.id,
  };
}

export async function createApiKey(services, context, input) {
  const scopes = [...new Set(input.scopes || [])];
  if (!scopes.length || scopes.some((scope) => !API_KEY_SCOPES.includes(scope)))
    throw new HttpError('API Key 权限范围无效', 400, 'API_KEY_SCOPES_INVALID');
  if (input.expiresAt) {
    const expiresAt = new Date(input.expiresAt).getTime();
    const maxExpiry = Date.now() + 2 * 365 * 24 * 60 * 60 * 1_000;
    if (!Number.isFinite(expiresAt) || expiresAt <= Date.now() || expiresAt > maxExpiry)
      throw new HttpError('API Key 到期时间必须在未来两年内', 400, 'API_KEY_EXPIRY_INVALID');
  }
  const generated = generateApiKey();
  const row = await createRow(services, TABLES.apiKeys, context.teamId, {
    name: input.name,
    keyPrefix: generated.keyPrefix,
    keyHash: generated.keyHash,
    scopes,
    createdBy: context.userId,
    expiresAt: input.expiresAt,
    revokedAt: undefined,
    lastUsedAt: undefined,
  });
  return { key: generated.secret, metadata: safeMetadata(row) };
}

export async function listApiKeys(services, teamId) {
  const rows = await listRows(services, TABLES.apiKeys, teamId, [Query.orderDesc('$createdAt')]);
  return rows.map(safeMetadata);
}

export async function revokeApiKey(services, context, keyId) {
  const row = await getOwned(services, TABLES.apiKeys, keyId, context.teamId);
  if (row.revokedAt) return safeMetadata(row);
  const updated = await updateOwned(services, TABLES.apiKeys, keyId, context.teamId, {
    revokedAt: new Date().toISOString(),
  });
  return safeMetadata(updated);
}
