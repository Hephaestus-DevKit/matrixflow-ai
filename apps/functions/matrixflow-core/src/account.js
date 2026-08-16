import { BUCKET_ID, HttpError, TABLES, deleteOwned, listRows } from './runtime.js';

const MAX_EXPORT_BYTES = 5 * 1024 * 1024;
const OWNED_TABLES = [
  ['agents', TABLES.agents, 'organizationId'],
  ['agentRuns', TABLES.agentRuns, 'organizationId'],
  ['contentProjects', TABLES.contentProjects, 'organizationId'],
  ['contentItems', TABLES.contentItems, 'organizationId'],
  ['knowledgeBases', TABLES.knowledgeBases, 'organizationId'],
  ['knowledgeDocuments', TABLES.knowledgeDocuments, 'organizationId'],
  ['knowledgeChunks', TABLES.knowledgeChunks, 'organizationId'],
  ['workflows', TABLES.workflows, 'organizationId'],
  ['workflowVersions', TABLES.workflowVersions, 'organizationId'],
  ['workflowRuns', TABLES.workflowRuns, 'organizationId'],
  ['customers', TABLES.customers, 'organizationId'],
  ['leads', TABLES.leads, 'organizationId'],
  ['conversations', TABLES.conversations, 'organizationId'],
  ['messages', TABLES.messages, 'organizationId'],
  ['marketplaceItems', TABLES.marketplaceItems, 'ownerOrganizationId'],
  ['marketplacePurchases', TABLES.marketplacePurchases, 'organizationId'],
  ['marketplaceReviews', TABLES.marketplaceReviews, 'organizationId'],
  ['usageRecords', TABLES.usageRecords, 'organizationId'],
  ['usageAggregates', TABLES.usageAggregates, 'organizationId'],
  ['usageCounters', TABLES.usageCounters, 'organizationId'],
  ['auditLogs', TABLES.auditLogs, 'organizationId'],
  ['billingRequests', TABLES.billingRequests, 'organizationId'],
  ['idempotencyKeys', TABLES.idempotencyKeys, 'organizationId'],
  ['subscriptions', TABLES.subscriptions, 'organizationId'],
  ['billingEvents', TABLES.billingEvents, 'organizationId'],
  ['billingInvoices', TABLES.billingInvoices, 'organizationId'],
  ['billingTransactions', TABLES.billingTransactions, 'organizationId'],
  ['apiKeys', TABLES.apiKeys, 'organizationId'],
];

const SECRET_KEY = /(key|secret|token|password|authorization|cookie)/i;
// Security and financial event records follow a separate retention policy;
// they are not silently destroyed by a personal data deletion request.
// Security and financial evidence follows the configured retention policy.
// Keep these rows after business-data deletion for disputes, refunds, tax
// requests, and incident investigations.
const RETAINED_TABLES = new Set([
  TABLES.auditLogs,
  TABLES.subscriptions,
  TABLES.billingEvents,
  TABLES.billingInvoices,
  TABLES.billingTransactions,
]);

function redact(value, key = '') {
  if (SECRET_KEY.test(key)) return '[REDACTED]';
  if (Array.isArray(value)) return value.map((item) => redact(item));
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value).map(([name, item]) => [name, redact(item, name)]),
  );
}

async function rowsFor(services, tableId, teamId, field) {
  return listRows(services, tableId, teamId, [], field);
}

/** Build a bounded, portable organization export with secrets redacted. */
export async function exportOrganization(services, teamId) {
  const tables = {};
  let rowCount = 0;
  for (const [name, tableId, field] of OWNED_TABLES) {
    const rows = await rowsFor(services, tableId, teamId, field);
    tables[name] = rows.map((row) => redact(row));
    rowCount += rows.length;
  }
  const exportData = {
    exportVersion: 1,
    generatedAt: new Date().toISOString(),
    organizationId: teamId,
    rowCount,
    sensitiveFieldsRedacted: true,
    fileContents: 'not-included',
    tables,
  };
  const serialized = JSON.stringify(exportData);
  if (Buffer.byteLength(serialized, 'utf8') > MAX_EXPORT_BYTES)
    throw new HttpError('导出数据过大，请按资源类型分批导出', 413, 'EXPORT_TOO_LARGE');
  return exportData;
}

/**
 * Delete all tenant-owned rows and knowledge files after explicit confirmation.
 * Appwrite does not provide a cross-table transaction, so callers receive a
 * per-table manifest and can retry safely; each delete is ownership checked.
 */
export async function deleteOrganization(services, teamId, confirmation, options = {}) {
  if (confirmation !== teamId)
    throw new HttpError('删除确认信息不匹配', 400, 'DELETE_CONFIRMATION_REQUIRED');
  const deleted = {};
  const documents = await rowsFor(services, TABLES.knowledgeDocuments, teamId, 'organizationId');
  for (const document of documents) {
    await services.storage
      .deleteFile({ bucketId: BUCKET_ID, fileId: document.fileId })
      .catch((error) => {
        if (Number(error?.status || error?.code) !== 404) throw error;
      });
  }
  for (const [name, tableId, field] of OWNED_TABLES) {
    if (RETAINED_TABLES.has(tableId)) {
      deleted[name] = 0;
      continue;
    }
    const rows = (await rowsFor(services, tableId, teamId, field)).filter(
      (row) => !(tableId === TABLES.idempotencyKeys && row.id === options.preserveIdempotencyId),
    );
    let count = 0;
    for (const row of rows) {
      await deleteOwned(services, tableId, row.id, teamId, field);
      count += 1;
    }
    deleted[name] = count;
  }
  return {
    deleted,
    totalRows: Object.values(deleted).reduce((sum, value) => sum + value, 0),
    filesDeleted: documents.length,
  };
}

export const accountExportTables = OWNED_TABLES.map(([name, tableId, field]) => ({
  name,
  tableId,
  field,
}));
