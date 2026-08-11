import { ExecutionMethod, ID, Permission, Query, Role, type Models } from 'appwrite';
import { appwriteFunctions, storage, tablesDB } from '@/lib/appwrite';
import { CORE_FUNCTION_ID, DATABASE_ID, KNOWLEDGE_BUCKET_ID, TABLES } from './constants';
import { getOrganizationContext } from './organization-context';

type Data = Record<string, unknown>;
type Row = Models.Row & Data;

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
  ) {
    super(message);
    this.name = 'BackendError';
  }
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

function encodeData(data: Data): Data {
  return Object.fromEntries(
    Object.entries(data)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [
        key,
        JSON_COLUMNS.has(key) && typeof value !== 'string' ? JSON.stringify(value) : value,
      ]),
  );
}

function teamPermissions(organizationId: string) {
  return [
    Permission.read(Role.team(organizationId)),
    Permission.update(Role.team(organizationId)),
    Permission.delete(Role.team(organizationId, 'owner')),
    Permission.delete(Role.team(organizationId, 'admin')),
  ];
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
  const result = await tablesDB.listRows<Row>({
    databaseId: DATABASE_ID,
    tableId,
    queries: [
      Query.equal(organizationField, organizationId),
      ...queries,
      Query.orderDesc('$createdAt'),
      Query.limit(100),
    ],
  });
  return result.rows.map(decodeRow);
}

export async function getRow(tableId: string, rowId: string, organizationField = 'organizationId') {
  const organizationId = getOrganizationContext();
  const row = decodeRow(await tablesDB.getRow<Row>({ databaseId: DATABASE_ID, tableId, rowId }));
  assertOwned(row, organizationId, organizationField);
  return row;
}

export async function createRow(tableId: string, data: Data, organizationField = 'organizationId') {
  const organizationId = getOrganizationContext();
  return decodeRow(
    await tablesDB.createRow<Row>({
      databaseId: DATABASE_ID,
      tableId,
      rowId: ID.unique(),
      data: encodeData({ ...data, [organizationField]: organizationId }),
      permissions: teamPermissions(organizationId),
    }),
  );
}

export async function updateRow(
  tableId: string,
  rowId: string,
  data: Data,
  organizationField = 'organizationId',
) {
  await getRow(tableId, rowId, organizationField);
  return decodeRow(
    await tablesDB.updateRow<Row>({
      databaseId: DATABASE_ID,
      tableId,
      rowId,
      data: encodeData(data),
    }),
  );
}

export async function deleteRow(
  tableId: string,
  rowId: string,
  organizationField = 'organizationId',
) {
  await getRow(tableId, rowId, organizationField);
  await tablesDB.deleteRow({ databaseId: DATABASE_ID, tableId, rowId });
}

export async function uploadKnowledgeFile(knowledgeBaseId: string, form: FormData) {
  await getRow(TABLES.knowledgeBases, knowledgeBaseId);
  const file = form.get('file');
  if (!(file instanceof File)) throw new BackendError('请选择要上传的文件', 400, 'FILE_REQUIRED');
  if (file.size > 20 * 1024 * 1024)
    throw new BackendError('文件不能超过 20 MB', 400, 'FILE_TOO_LARGE');
  const organizationId = getOrganizationContext();
  const permissions = teamPermissions(organizationId);
  const uploaded = await storage.createFile({
    bucketId: KNOWLEDGE_BUCKET_ID,
    fileId: ID.unique(),
    file,
    permissions,
  });
  try {
    const document = await createRow(TABLES.knowledgeDocuments, {
      knowledgeBaseId,
      title: file.name.slice(0, 255),
      fileId: uploaded.$id,
      mimeType: file.type || 'application/octet-stream',
      size: file.size,
      status: 'UPLOADED',
    });
    await executeCore('/kb/index', { documentId: document.id }).catch(() => undefined);
    return document;
  } catch (error) {
    await storage
      .deleteFile({ bucketId: KNOWLEDGE_BUCKET_ID, fileId: uploaded.$id })
      .catch(() => undefined);
    throw error;
  }
}

export async function executeCore<T>(path: string, body: Data, method = ExecutionMethod.POST) {
  const execution = await appwriteFunctions.createExecution({
    functionId: CORE_FUNCTION_ID,
    body: JSON.stringify({ ...body, organizationId: getOrganizationContext() }),
    async: false,
    xpath: path,
    method,
    headers: { 'content-type': 'application/json' },
  });
  const payload = parseJson(execution.responseBody) as
    { data?: T; error?: { message?: string; code?: string } } | T;
  if (execution.responseStatusCode < 200 || execution.responseStatusCode >= 300) {
    const envelope = payload as { error?: { message?: string; code?: string } };
    throw new BackendError(
      envelope.error?.message || '核心服务执行失败',
      execution.responseStatusCode || 500,
      envelope.error?.code || 'FUNCTION_ERROR',
    );
  }
  return ((payload as { data?: T }).data ?? payload) as T;
}
