import test from 'node:test';
import assert from 'node:assert/strict';
import { claimIdempotency, completeIdempotency } from '../src/idempotency.js';

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

test('an oversized successful response retains a completion marker and cannot repeat the write', async () => {
  let row = {
    $id: 'claim-1',
    organizationId: 'team-1',
    fingerprint: 'fingerprint-1',
    status: 102,
    response: '',
  };
  let deleted = false;
  const services = {
    tables: {
      getRow: async () => row,
      updateRow: async ({ data }) => {
        row = { ...row, ...data };
        return row;
      },
      deleteRow: async () => {
        deleted = true;
      },
      listRows: async () => ({ total: 1, rows: [row] }),
    },
  };
  assert.equal(
    await completeIdempotency(
      services,
      'team-1',
      'claim-1',
      { data: '资料'.repeat(20_000), meta: { requestId: 'request-1' } },
      200,
    ),
    true,
  );
  assert.equal(deleted, false);
  const retry = await claimIdempotency(services, 'team-1', {
    key: 'request-1234',
    fingerprint: 'fingerprint-1',
    method: 'POST',
    path: '/workflows',
  });
  assert.equal(retry.status, 409);
  assert.equal(retry.replay.error.code, 'IDEMPOTENCY_REPLAY_UNAVAILABLE');
  assert.equal(retry.replay.error.requestId, 'request-1');
});
