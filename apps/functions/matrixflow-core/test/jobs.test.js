import test from 'node:test';
import assert from 'node:assert/strict';
import { claimJob, enqueueJob, listJobs, verifyWorkerRequest } from '../src/jobs.js';

function withWorkerSecret(value) {
  const previous = process.env.MATRIXFLOW_WORKER_SECRET;
  process.env.MATRIXFLOW_WORKER_SECRET = value;
  return () => {
    if (previous === undefined) delete process.env.MATRIXFLOW_WORKER_SECRET;
    else process.env.MATRIXFLOW_WORKER_SECRET = previous;
  };
}

test('async jobs are durable before dispatch and use an internal authenticated execution', async () => {
  const restore = withWorkerSecret('x'.repeat(40));
  const executions = [];
  try {
    const services = {
      tables: {
        createRow: async ({ rowId, data }) => ({ $id: rowId, ...data }),
        getRow: async ({ rowId }) => ({ $id: rowId, organizationId: 'team-1' }),
      },
      functions: {
        createExecution: async (input) => {
          executions.push(input);
          return { $id: 'execution-1' };
        },
      },
    };
    const result = await enqueueJob(
      services,
      { teamId: 'team-1', userId: 'user-1', requestId: 'req-1' },
      'agent.run',
      { agentId: 'agent-1', input: { prompt: 'hello' } },
    );
    assert.equal(result.status, 'QUEUED');
    assert.equal(executions.length, 1);
    assert.equal(executions[0].xpath, '/internal/jobs/execute');
    assert.equal(executions[0].async, true);
    assert.equal(executions[0].headers['x-matrixflow-worker-secret'], 'x'.repeat(40));
    assert.equal(JSON.parse(executions[0].body).organizationId, 'team-1');
  } finally {
    restore();
  }
});

test('worker invocations fail closed on missing or incorrect credentials', () => {
  const restore = withWorkerSecret('y'.repeat(40));
  try {
    assert.throws(
      () => verifyWorkerRequest({ 'x-matrixflow-worker-secret': 'wrong' }),
      (error) => error.code === 'JOB_WORKER_UNAUTHORIZED',
    );
    assert.doesNotThrow(() =>
      verifyWorkerRequest({ 'x-matrixflow-worker-secret': 'y'.repeat(40) }),
    );
  } finally {
    restore();
  }
});

test('job claims use an atomic status predicate and issue a bounded lease token', async () => {
  const calls = [];
  const services = {
    tables: {
      updateRows: async (input) => {
        calls.push(input);
        return {
          rows: [
            {
              $id: 'job-1',
              organizationId: 'team-1',
              status: 'RUNNING',
              attempts: 1,
              leaseToken: input.data.leaseToken,
            },
          ],
        };
      },
    },
  };
  const claimed = await claimJob(
    services,
    {
      id: 'job-1',
      organizationId: 'team-1',
      status: 'QUEUED',
      attempts: 0,
      runAfter: new Date(0).toISOString(),
    },
    Date.now(),
    'request-1',
  );
  assert.equal(claimed.status, 'RUNNING');
  assert.match(claimed.leaseToken, /^request-1-/);
  assert.equal(calls.length, 1);
  assert.ok(calls[0].queries.some((query) => query.includes('status')));
  assert.equal(calls[0].data.status, 'RUNNING');
  assert.equal(calls[0].data.attempts, 1);
});

test('a duplicate delivery that loses the atomic claim does not receive a lease', async () => {
  const services = { tables: { updateRows: async () => ({ rows: [] }) } };
  const claimed = await claimJob(
    services,
    {
      id: 'job-2',
      organizationId: 'team-1',
      status: 'QUEUED',
      attempts: 0,
      runAfter: new Date(0).toISOString(),
    },
    Date.now(),
    'request-2',
  );
  assert.equal(claimed, null);
});

test('job lists are tenant-scoped, paginated, and exclude worker internals', async () => {
  const calls = [];
  const services = {
    tables: {
      listRows: async (input) => {
        calls.push(input);
        return {
          total: 3,
          rows: [
            {
              $id: 'job-1',
              organizationId: 'team-1',
              type: 'agent.run',
              status: 'RUNNING',
              attempts: 1,
              maxAttempts: 3,
              runAfter: '2026-08-25T00:00:00.000Z',
              payload: JSON.stringify({ prompt: 'private' }),
              result: JSON.stringify({ content: 'private' }),
              error: 'private error',
              leaseToken: 'private-lease',
            },
          ],
        };
      },
    },
  };

  const page = await listJobs(services, 'team-1', { limit: 1, offset: 1 });
  assert.equal(page.total, 3);
  assert.equal(page.limit, 1);
  assert.equal(page.offset, 1);
  assert.equal(page.nextOffset, 2);
  assert.equal(page.data[0].id, 'job-1');
  assert.equal(Object.hasOwn(page.data[0], 'payload'), false);
  assert.equal(Object.hasOwn(page.data[0], 'result'), false);
  assert.equal(Object.hasOwn(page.data[0], 'error'), false);
  assert.equal(Object.hasOwn(page.data[0], 'leaseToken'), false);
  assert.ok(calls[0].queries.some((query) => query.includes('organizationId')));
  assert.ok(calls[0].queries.some((query) => query.includes('limit')));
  assert.ok(calls[0].queries.some((query) => query.includes('offset')));
});

test('job list pagination falls back safely for malformed values', async () => {
  let request;
  const services = {
    tables: {
      listRows: async (input) => {
        request = input;
        return { total: 0, rows: [] };
      },
    },
  };
  const page = await listJobs(services, 'team-1', { limit: 'nope', offset: 'nope' });
  assert.equal(page.limit, 25);
  assert.equal(page.offset, 0);
  assert.ok(request.queries.some((query) => query.includes('limit')));
  assert.ok(request.queries.some((query) => query.includes('offset')));
});

test('job lists preserve the legacy array response without pagination options', async () => {
  const services = {
    tables: {
      listRows: async () => ({
        total: 1,
        rows: [{ $id: 'job-1', organizationId: 'team-1', type: 'agent.run', status: 'SUCCEEDED' }],
      }),
    },
  };
  const result = await listJobs(services, 'team-1');
  assert.ok(Array.isArray(result));
  assert.equal(result[0].id, 'job-1');
});
