import { readFile } from 'node:fs/promises';
import { Client, Compression, OrderBy, Storage, TablesDB, TablesDBIndexType } from 'node-appwrite';

const endpoint = process.env.MATRIXFLOW_APPWRITE_ENDPOINT || 'https://sgp.cloud.appwrite.io/v1';
const projectId = process.env.MATRIXFLOW_APPWRITE_PROJECT_ID || '6a43f0af000862e7b0ef';
const key = process.env.MATRIXFLOW_DEPLOY_KEY;
if (!key) throw new Error('MATRIXFLOW_DEPLOY_KEY is required');

const root = new URL('../../../../', import.meta.url);
const tablesConfig = JSON.parse(
  await readFile(new URL('infra/appwrite/tables.json', root), 'utf8'),
);
const bucketsConfig = JSON.parse(
  await readFile(new URL('infra/appwrite/buckets.json', root), 'utf8'),
);
const databaseId = 'matrixflow';
const client = new Client().setEndpoint(endpoint).setProject(projectId).setKey(key);
const tables = new TablesDB(client);
const storage = new Storage(client);

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const isMissing = (error) => error?.code === 404;

async function waitFor(getResource, label) {
  for (let attempt = 0; attempt < 90; attempt += 1) {
    const resource = await getResource();
    if (!resource.status || resource.status === 'available') return resource;
    if (resource.status === 'failed' || resource.error)
      throw new Error(`${label}: ${resource.error || 'creation failed'}`);
    await sleep(1_000);
  }
  throw new Error(`${label}: timed out`);
}

async function ensureDatabase() {
  try {
    await tables.get({ databaseId });
  } catch (error) {
    if (!isMissing(error)) throw error;
    await tables.create({ databaseId, name: 'MatrixFlow Core', enabled: true });
  }
}

async function ensureTable(table) {
  try {
    await tables.getTable({ databaseId, tableId: table.$id });
  } catch (error) {
    if (!isMissing(error)) throw error;
    await tables.createTable({
      databaseId,
      tableId: table.$id,
      name: table.name,
      permissions: table.$permissions,
      rowSecurity: table.rowSecurity,
      enabled: table.enabled,
    });
  }
  await tables.updateTable({
    databaseId,
    tableId: table.$id,
    name: table.name,
    permissions: table.$permissions,
    rowSecurity: table.rowSecurity,
    enabled: table.enabled,
  });
}

function defaultArguments(column) {
  return Object.prototype.hasOwnProperty.call(column, 'default')
    ? { xdefault: column.default }
    : {};
}

async function createColumn(tableId, column) {
  const base = {
    databaseId,
    tableId,
    key: column.key,
    required: column.required,
    array: Boolean(column.array),
    ...defaultArguments(column),
  };
  if (column.format === 'email') return tables.createEmailColumn(base);
  if (column.type === 'varchar') return tables.createVarcharColumn({ ...base, size: column.size });
  if (column.type === 'text') return tables.createTextColumn(base);
  if (column.type === 'mediumtext') return tables.createMediumtextColumn(base);
  if (column.type === 'longtext') return tables.createLongtextColumn(base);
  if (column.type === 'integer')
    return tables.createIntegerColumn({ ...base, min: column.min, max: column.max });
  if (column.type === 'double')
    return tables.createFloatColumn({ ...base, min: column.min, max: column.max });
  if (column.type === 'boolean') return tables.createBooleanColumn(base);
  if (column.type === 'datetime') return tables.createDatetimeColumn(base);
  throw new Error(`Unsupported column type: ${column.type}`);
}

async function ensureColumn(tableId, column) {
  try {
    await tables.getColumn({ databaseId, tableId, key: column.key });
  } catch (error) {
    if (!isMissing(error)) throw error;
    await createColumn(tableId, column);
  }
  await waitFor(
    () => tables.getColumn({ databaseId, tableId, key: column.key }),
    `${tableId}.${column.key}`,
  );
}

async function ensureIndex(tableId, index) {
  try {
    await tables.getIndex({ databaseId, tableId, key: index.key });
  } catch (error) {
    if (!isMissing(error)) throw error;
    await tables.createIndex({
      databaseId,
      tableId,
      key: index.key,
      type: index.type === 'unique' ? TablesDBIndexType.Unique : TablesDBIndexType.Key,
      columns: index.columns,
      orders: index.orders?.map((order) =>
        order.toLowerCase() === 'desc' ? OrderBy.Desc : OrderBy.Asc,
      ),
    });
  }
  await waitFor(
    () => tables.getIndex({ databaseId, tableId, key: index.key }),
    `${tableId}.${index.key}`,
  );
}

async function ensureBucket(bucket) {
  try {
    await storage.getBucket({ bucketId: bucket.$id });
  } catch (error) {
    if (!isMissing(error)) throw error;
    await storage.createBucket({
      bucketId: bucket.$id,
      name: bucket.name,
      permissions: bucket.$permissions,
      fileSecurity: bucket.fileSecurity,
      enabled: bucket.enabled,
      maximumFileSize: bucket.maximumFileSize,
      allowedFileExtensions: bucket.allowedFileExtensions,
      compression: bucket.compression === 'gzip' ? Compression.Gzip : Compression.None,
      encryption: bucket.encryption,
      antivirus: bucket.antivirus,
      transformations: false,
    });
  }
  await storage.updateBucket({
    bucketId: bucket.$id,
    name: bucket.name,
    permissions: bucket.$permissions,
    fileSecurity: bucket.fileSecurity,
    enabled: bucket.enabled,
    maximumFileSize: bucket.maximumFileSize,
    allowedFileExtensions: bucket.allowedFileExtensions,
    compression: bucket.compression === 'gzip' ? Compression.Gzip : Compression.None,
    encryption: bucket.encryption,
    antivirus: bucket.antivirus,
    transformations: false,
  });
}

await ensureDatabase();
for (const table of tablesConfig) {
  await ensureTable(table);
  for (const column of table.columns || []) await ensureColumn(table.$id, column);
  for (const index of table.indexes || []) await ensureIndex(table.$id, index);
  process.stdout.write(`provisioned table ${table.$id}\n`);
}
for (const bucket of bucketsConfig) {
  await ensureBucket(bucket);
  process.stdout.write(`provisioned bucket ${bucket.$id}\n`);
}
