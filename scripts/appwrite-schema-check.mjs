import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const requiredTables = [
  'agents',
  'agent_runs',
  'content_projects',
  'content_items',
  'knowledge_bases',
  'knowledge_documents',
  'knowledge_chunks',
  'workflows',
  'workflow_versions',
  'workflow_runs',
  'customers',
  'leads',
  'conversations',
  'messages',
  'marketplace_items',
  'marketplace_purchases',
  'marketplace_reviews',
  'usage_records',
  'usage_aggregates',
  'usage_counters',
  'audit_logs',
  'billing_requests',
  'idempotency_keys',
  'subscriptions',
  'billing_events',
  'background_jobs',
  'api_keys',
  'billing_invoices',
  'billing_transactions',
];

const requiredUniqueIndexes = {
  idempotency_keys: ['organizationId', 'key'],
  subscriptions: ['organizationId'],
  billing_events: ['eventId'],
  api_keys: ['keyPrefix'],
  billing_invoices: ['externalInvoiceId'],
  billing_transactions: ['externalTransactionId'],
  usage_counters: ['organizationId', 'bucket'],
  usage_aggregates: ['organizationId', 'period', 'metric', 'dimensionType', 'dimensionValue'],
};

export function validateSchema(tables) {
  const errors = [];
  const ids = tables.map((table) => table.$id);
  if (new Set(ids).size !== ids.length) errors.push('table IDs must be unique');
  for (const id of requiredTables)
    if (!ids.includes(id)) errors.push(`missing required table: ${id}`);
  for (const table of tables) {
    const columns = new Set((table.columns || []).map((column) => column.key));
    if (!table.rowSecurity) errors.push(`${table.$id}: rowSecurity must be enabled`);
    if (!Array.isArray(table.$permissions) || table.$permissions.length !== 0)
      errors.push(`${table.$id}: table permissions must stay empty; access is row/function scoped`);
    const tenantField =
      table.$id === 'marketplace_items' ? 'ownerOrganizationId' : 'organizationId';
    if (requiredTables.includes(table.$id) && !columns.has(tenantField))
      errors.push(`${table.$id}: missing tenant boundary column ${tenantField}`);
    if (columns.size !== (table.columns || []).length)
      errors.push(`${table.$id}: duplicate column`);
    for (const index of table.indexes || []) {
      for (const column of index.columns || []) {
        if (!columns.has(column))
          errors.push(`${table.$id}.${index.key}: unknown column ${column}`);
      }
    }
    const requiredUnique = requiredUniqueIndexes[table.$id];
    if (
      requiredUnique &&
      !(table.indexes || []).some(
        (index) =>
          index.type === 'unique' &&
          index.columns?.length === requiredUnique.length &&
          index.columns.every((column, indexPosition) => column === requiredUnique[indexPosition]),
      )
    ) {
      errors.push(`${table.$id}: missing required unique index (${requiredUnique.join(', ')})`);
    }
  }
  return { ok: errors.length === 0, errors, count: tables.length };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const tables = JSON.parse(await readFile(new URL('infra/appwrite/tables.json', root), 'utf8'));
  const result = validateSchema(tables);
  if (!result.ok) {
    for (const error of result.errors) process.stderr.write(`ERROR ${error}\n`);
    process.exitCode = 1;
  } else {
    process.stdout.write(`Appwrite schema valid: ${result.count} tables\n`);
  }
}
