import test from 'node:test';
import assert from 'node:assert/strict';
import { claimIdempotency } from '../src/idempotency.js';

test('idempotency claims are created before work and block duplicate execution', async () => {
  let row;
  const services = {
    tables: {
      listRows: async () => ({ total: row ? 1 : 0, rows: row ? [row] : [] }),
      createRow: async ({ rowId, data }) => {
        row = { $id: rowId, ...data };
        return row;
      },
    },
  };
  const input = {
    key: 'request-1234',
    fingerprint: 'fingerprint-1',
    method: 'POST',
    path: '/agents',
  };
  const first = await claimIdempotency(services, 'team-1', input);
  assert.equal(first.replay, null);
  assert.equal(first.claim.status, 102);
  await assert.rejects(
    () => claimIdempotency(services, 'team-1', input),
    (error) => error.code === 'IDEMPOTENCY_IN_PROGRESS',
  );
  await assert.rejects(
    () => claimIdempotency(services, 'team-1', { ...input, fingerprint: 'different' }),
    (error) => error.code === 'IDEMPOTENCY_CONFLICT',
  );
});
