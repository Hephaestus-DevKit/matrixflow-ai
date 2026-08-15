import { ExecutionMethod, ID, Permission, Query, Role, type Models } from 'appwrite';
import { appwriteFunctions, storage, tablesDB } from '@/lib/appwrite';
import { CORE_FUNCTION_ID, DATABASE_ID, KNOWLEDGE_BUCKET_ID, TABLES } from './constants';
import { getOrganizationContext } from './organization-context';

type Data = Record<string, unknown>;
type Row = Models.Row & Data;
const PAGE_SIZE = 100;
const MAX_LIST_ROWS = 10_000;

const JSON_COLUMNS = new Set([
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

export class BackendError extends Error {
  constructor(
    message: string,
    public readonly status = 500,
    public readonly code = 'BACKEND_ERROR',
    public readonly requestId?: string,
  ) {
    super(message);
    this.name = 'BackendError';
  }
}

function normalizeAppwriteError(error: unknown, fallback = 'Appwrite 服务暂时不可用') {
  if (error instanceof BackendError) return error;
  const candidate = error as { code?: unknown; type?: unknown };
  const status = Number(candidate?.code);
  if (status === 401) return new BackendError('登录状态已失效，请重新登录', 401, 'UNAUTHENTICATED');
  if (status === 403) return new BackendError('无权访问该团队资源', 403, 'FORBIDDEN');
  if (status === 404) return new BackendError('资源不存在或已被删除', 404, 'RESOURCE_NOT_FOUND');
  if (status === 409) return new BackendError('资源状态发生冲突，请刷新后重试', 409, 'CONFLICT');
  if (status === 429) return new BackendError('请求过于频繁，请稍后重试', 429, 'RATE_LIMITED');
  if (typeof candidate?.type === 'string' && candidate.type === 'general_rate_limit_exceeded')
    return new BackendError('请求过于频繁，请稍后重试', 429, 'RATE_LIMITED');
  return new BackendError(fallback, status >= 400 && status < 600 ? status : 502, 'APPWRITE_ERROR');
}

function parseJson(value: unknown) {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

function decodeRow(row: Row): Data {
  const output: Data = { id: row.$id, createdAt: row.$createdAt, updatedAt: row.$updatedAt };
  for (const [key, value] of Object.entries(row)) {
    if (!key.startsWith('$')) output[key] = JSON_COLUMNS.has(key) ? parseJson(value) : value;
  }
  return output;
}

function teamPermissions(organizationId: string) {
  // Files are uploaded by verified users, but subsequent writes stay inside
  // the Function boundary where the team capability checks run.
  return [Permission.read(Role.team(organizationId))];
}

function assertOwned(row: Data, organizationId: string, field = 'organizationId') {
  if (row[field] !== organizationId) throw new BackendError('无权访问该团队资源', 403, 'FORBIDDEN');
}

export async function listRows(
  tableId: string,
  queries: string[] = [],
  organizationField = 'organizationId',
) {
  const organizationId = getOrganizationContext();
  const rows: Data[] = [];
  let total = 0;
  const hasOrdering = queries.some((query) => query.includes('order'));
  for (let offset = 0; offset < MAX_LIST_ROWS; offset += PAGE_SIZE) {
    let result: Models.RowList<Row>;
    try {
      result = await tablesDB.listRows<Row>({
        databaseId: DATABASE_ID,
        tableId,
        queries: [
          Query.equal(organizationField, organizationId),
          ...queries,
          ...(hasOrdering ? [] : [Query.orderDesc('$createdAt')]),
          Query.limit(PAGE_SIZE),
          Query.offset(offset),
        ],
      });
    } catch (error) {
      throw normalizeAppwriteError(error);
    }
    total = result.total;
    rows.push(...result.rows.map(decodeRow));
    if (result.rows.length < PAGE_SIZE || rows.length >= result.total) break;
  }
  if (rows.length >= MAX_LIST_ROWS && total > MAX_LIST_ROWS)
    throw new BackendError('资源数量超过单次可加载上限，请缩小查询范围', 413, 'LIST_TOO_LARGE');
  return rows;
}

export async function countRows(
  tableId: string,
  queries: string[] = [],
  organizationField = 'organizationId',
) {
  const organizationId = getOrganizationContext();
  try {
    const result = await tablesDB.listRows<Row>({
      databaseId: DATABASE_ID,
      tableId,
      queries: [Query.equal(organizationField, organizationId), ...queries, Query.limit(1)],
    });
    return Number(result.total || 0);
  } catch (error) {
    throw normalizeAppwriteError(error);
  }
}

export async function getRow(tableId: string, rowId: string, organizationField = 'organizationId') {
  const organizationId = getOrganizationContext();
  let rawRow: Row;
  try {
    rawRow = await tablesDB.getRow<Row>({ databaseId: DATABASE_ID, tableId, rowId });
  } catch (error) {
    throw normalizeAppwriteError(error);
  }
  const row = decodeRow(rawRow);
  assertOwned(row, organizationId, organizationField);
  return row;
}

export async function uploadKnowledgeFile(
  knowledgeBaseId: string,
  form: FormData,
  options: { idempotencyKey?: string } = {},
) {
  await getRow(TABLES.knowledgeBases, knowledgeBaseId);
  const file = form.get('file');
  if (!(file instanceof File)) throw new BackendError('请选择要上传的文件', 400, 'FILE_REQUIRED');
  if (file.size > 20 * 1024 * 1024)
    throw new BackendError('文件不能超过 20 MB', 400, 'FILE_TOO_LARGE');
  const organizationId = getOrganizationContext();
  const permissions = teamPermissions(organizationId);
  const deterministicFileId = options.idempotencyKey
    ? options.idempotencyKey.replace(/[^A-Za-z0-9._-]/g, '').slice(0, 36)
    : undefined;
  const fileId =
    deterministicFileId && deterministicFileId.length >= 8 ? deterministicFileId : ID.unique();
  let uploaded: Models.File;
  try {
    uploaded = await storage.createFile({
      bucketId: KNOWLEDGE_BUCKET_ID,
      fileId,
      file,
      permissions,
    });
  } catch (error) {
    // A retried upload reuses the same file ID. Resume from the existing
    // object instead of allocating another storage object; reject a mismatch
    // so one idempotency key can never silently point at two files.
    if (deterministicFileId && Number((error as { code?: unknown })?.code) === 409) {
      try {
        const existing = await storage.getFile({
          bucketId: KNOWLEDGE_BUCKET_ID,
          fileId: deterministicFileId,
        });
        if (Number(existing.sizeOriginal) !== file.size)
          throw new BackendError('同一幂等键对应的文件大小不一致', 409, 'UPLOAD_RETRY_CONFLICT');
        uploaded = existing;
      } catch (retryError) {
        if (retryError instanceof BackendError) throw retryError;
        throw normalizeAppwriteError(retryError, '重复上传无法恢复，请重新选择文件');
      }
    } else {
      throw normalizeAppwriteError(error, '文件上传失败，请稍后重试');
    }
  }
  let document: Data | undefined;
  const baseKey = options.idempotencyKey;
  try {
    document = await executeCore<Data>(
      '/kb/documents',
      {
        knowledgeBaseId,
        title: file.name.slice(0, 255),
        fileId: uploaded.$id,
        mimeType: file.type || 'application/octet-stream',
        size: file.size,
      },
      ExecutionMethod.POST,
      baseKey ? { idempotencyKey: `${baseKey}:document` } : {},
    );
  } catch (error) {
    await storage
      .deleteFile({ bucketId: KNOWLEDGE_BUCKET_ID, fileId: uploaded.$id })
      .catch(() => undefined);
    throw error;
  }
  try {
    return await executeCore<Data>(
      '/kb/index',
      { documentId: document.id },
      ExecutionMethod.POST,
      baseKey ? { idempotencyKey: `${baseKey}:index` } : {},
    );
  } catch (error) {
    return {
      ...document,
      status: 'ERROR',
      error: error instanceof Error ? error.message : '索引失败，请稍后重试',
    };
  }
}

export async function executeCore<T>(
  path: string,
  body: Data,
  method = ExecutionMethod.POST,
  options: { idempotencyKey?: string } = {},
) {
  let execution: Models.Execution;
  try {
    execution = await appwriteFunctions.createExecution({
      functionId: CORE_FUNCTION_ID,
      body: JSON.stringify({
        ...body,
        organizationId: getOrganizationContext(),
        ...(options.idempotencyKey ? { __idempotencyKey: options.idempotencyKey } : {}),
      }),
      async: false,
      xpath: path,
      method,
      headers: { 'content-type': 'application/json' },
    });
  } catch (error) {
    throw normalizeAppwriteError(error, '核心服务暂时不可用');
  }
  const payload = parseJson(execution.responseBody) as
    { data?: T; error?: { message?: string; code?: string; requestId?: string } } | T;
  if (execution.responseStatusCode < 200 || execution.responseStatusCode >= 300) {
    const envelope = payload as {
      error?: { message?: string; code?: string; requestId?: string };
    };
    throw new BackendError(
      envelope.error?.message || '核心服务执行失败',
      execution.responseStatusCode || 500,
      envelope.error?.code || 'FUNCTION_ERROR',
      envelope.error?.requestId,
    );
  }
  return ((payload as { data?: T }).data ?? payload) as T;
}
