import test from 'node:test';
import assert from 'node:assert/strict';
import { deleteOrganization, exportOrganization } from '../src/account.js';

function servicesFor(rowsByTable = {}) {
  const deleted = [];
  return {
    deleted,
    tables: {
      listRows: async ({ tableId }) => ({
        total: (rowsByTable[tableId] || []).length,
        rows: rowsByTable[tableId] || [],
      }),
      getRow: async ({ tableId, rowId }) => ({
        $id: rowId,
        organizationId: 'team-1',
        ...(rowsByTable[tableId] || []).find((row) => row.$id === rowId),
      }),
      deleteRow: async ({ tableId, rowId }) => deleted.push(`${tableId}:${rowId}`),
    },
    storage: {
      deleteFile: async () => undefined,
    },
  };
}

test('organization exports redact secret-shaped fields and include an explicit schema version', async () => {
  const services = servicesFor({
    agents: [
      {
        $id: 'agent-1',
        organizationId: 'team-1',
        name: 'Support',
        configuration: JSON.stringify({ apiKey: 'do-not-export' }),
      },
    ],
  });
  const result = await exportOrganization(services, 'team-1');
  assert.equal(result.exportVersion, 1);
  assert.equal(result.sensitiveFieldsRedacted, true);
  assert.equal(result.tables.agents[0].configuration.apiKey, '[REDACTED]');
  assert.equal(result.fileContents, 'not-included');
});

test('organization deletion requires exact confirmation and retains audit/billing records', async () => {
  const services = servicesFor({
    agents: [{ $id: 'agent-1', organizationId: 'team-1' }],
    audit_logs: [{ $id: 'audit-1', organizationId: 'team-1' }],
    subscriptions: [{ $id: 'subscription-1', organizationId: 'team-1' }],
    billing_events: [{ $id: 'event-1', organizationId: 'team-1' }],
    billing_invoices: [{ $id: 'invoice-1', organizationId: 'team-1' }],
    billing_transactions: [{ $id: 'transaction-1', organizationId: 'team-1' }],
  });
  await assert.rejects(
    () => deleteOrganization(services, 'team-1', 'wrong-team'),
    (error) => error.code === 'DELETE_CONFIRMATION_REQUIRED',
  );
  const result = await deleteOrganization(services, 'team-1', 'team-1');
  assert.equal(result.totalRows, 1);
  assert.deepEqual(services.deleted, ['agents:agent-1']);
  assert.equal(result.deleted.subscriptions, 0);
  assert.equal(result.deleted.billingInvoices, 0);
  assert.equal(result.deleted.billingTransactions, 0);
});

test('organization deletion preserves the active idempotency claim for replay', async () => {
  const services = servicesFor({
    idempotency_keys: [
      { $id: 'claim-current', organizationId: 'team-1' },
      { $id: 'claim-old', organizationId: 'team-1' },
    ],
  });
  const result = await deleteOrganization(services, 'team-1', 'team-1', {
    preserveIdempotencyId: 'claim-current',
  });
  assert.equal(result.deleted.idempotencyKeys, 1);
  assert.deepEqual(services.deleted, ['idempotency_keys:claim-old']);
});
