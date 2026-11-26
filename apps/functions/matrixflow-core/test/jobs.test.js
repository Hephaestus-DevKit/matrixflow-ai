import test from 'node:test';
import assert from 'node:assert/strict';
import {
  cancelJob,
  claimJob,
  enqueueJob,
  executeJob,
  getJob,
  listJobs,
  recoverStaleJob,
  verifyWorkerRequest,
} from '../src/jobs.js';

function withWorkerSecret(value) {
  const previous = process.env.MATRIXFLOW_WORKER_SECRET;
  process.env.MATRIXFLOW_WORKER_SECRET = value;
  return () => {
    if (previous === undefined) delete process.env.MATRIXFLOW_WORKER_SECRET;
    else process.env.MATRIXFLOW_WORKER_SECRET = previous;
  };
}

function jobStore(initial, { afterCommit, beforeCommit, beforeUpdate, getResource, onList } = {}) {
  let row = {
    $id: 'job-1',
    organizationId: 'team-1',
    status: 'QUEUED',
    type: 'agent.run',
    attempts: 0,
    maxAttempts: 3,
    cancelRequested: false,
    runAfter: new Date(0).toISOString(),
    payload: JSON.stringify({ agentId: 'agent-1' }),
    ...initial,
  };
  const transactions = new Map();
  const committedTransactions = new Set();
  let nextTransaction = 0;
  let revision = 0;
  return {
    createRow: async ({ rowId, data }) => {
      row = { $id: rowId, ...data };
      revision++;
      return { ...row };
    },
    getRow: async ({ tableId }) => {
      if (tableId !== 'background_jobs') return getResource?.();
      return { ...row };
    },
    createTransaction: async () => ({ $id: String(++nextTransaction) }),
    getTransaction: async ({ transactionId }) => ({
      status: committedTransactions.has(transactionId) ? 'committed' : 'pending',
    }),
    updateRow: async ({ rowId, data, transactionId }) => {
      assert.equal(rowId, row.$id);
      const concurrentChange = beforeUpdate?.(data);
      if (concurrentChange) {
        row = { ...row, ...concurrentChange };
        revision++;
      }
      transactions.set(transactionId, { data, revision });
      return { ...row, ...data };
    },
    listRows: async (input) => {
      const { queries } = input;
      onList?.(input);
      const matches = queries.every((raw) => {
        const { method, attribute, values } = JSON.parse(raw);
        if (method === 'equal') return values.includes(row[attribute]);
        if (method === 'limit') return true;
        assert.fail(`Unhandled query method: ${method}`);
      });
      return { rows: matches ? [{ ...row }] : [] };
    },
    updateTransaction: async ({ transactionId, commit }) => {
      const staged = transactions.get(transactionId);
      transactions.delete(transactionId);
      if (!commit) return;
      const concurrentChange = beforeCommit?.(staged.data);
      if (concurrentChange) {
        row = { ...row, ...concurrentChange };
        revision++;
      }
      if (staged.revision !== revision) {
        throw Object.assign(new Error('Transaction conflict'), { code: 409 });
      }
      row = { ...row, ...staged.data };
      revision++;
      committedTransactions.add(transactionId);
      afterCommit?.(staged.data);
    },
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

test('job claims read the committed tenant row without caching and issue a bounded token', async () => {
  const calls = [];
  const services = { tables: jobStore({}, { onList: (input) => calls.push(input) }) };
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
    'request-1'.repeat(10),
  );
  assert.equal(claimed.status, 'RUNNING');
  assert.match(claimed.leaseToken, /^request-1/);
  assert.equal(claimed.leaseToken.length, 64);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].ttl, 0);
  assert.equal(calls[0].transactionId, undefined);
  assert.ok(calls[0].queries.some((query) => query.includes('organizationId')));
  assert.equal(claimed.attempts, 1);
});

test('a duplicate delivery that loses the atomic claim does not receive a lease', async () => {
  const services = { tables: jobStore({ $id: 'job-2', status: 'RUNNING' }) };
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

test('simultaneous deliveries can commit only one lease', async () => {
  const tables = jobStore({});
  const row = await tables.getRow({ tableId: 'background_jobs' });
  const job = { id: row.$id, ...row };
  const claims = await Promise.all([
    claimJob({ tables }, job, Date.now(), 'worker-a'),
    claimJob({ tables }, job, Date.now(), 'worker-b'),
  ]);
  assert.equal(claims.filter(Boolean).length, 1);
  assert.equal((await tables.getRow({ tableId: 'background_jobs' })).attempts, 1);
});

test('a claim remains usable when the committed transaction response is lost', async () => {
  const tables = jobStore(
    {},
    {
      afterCommit() {
        throw new Error('Transaction response lost');
      },
    },
  );
  const row = await tables.getRow({ tableId: 'background_jobs' });
  const claim = await claimJob({ tables }, { id: row.$id, ...row });
  assert.equal(claim.status, 'RUNNING');
  assert.equal(claim.leaseToken, (await tables.getRow({ tableId: 'background_jobs' })).leaseToken);
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
              leaseExpiresAt: new Date(Date.now() + 60_000).toISOString(),
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

test('a retryable worker failure persists a retry and dispatches it instead of crashing', async () => {
  const restore = withWorkerSecret('z'.repeat(40));
  const executions = [];
  const services = {
    tables: jobStore(
      {},
      {
        getResource() {
          throw Object.assign(new Error('upstream private details'), { code: 'AI_NETWORK_ERROR' });
        },
      },
    ),
    functions: {
      createExecution: async (input) => {
        executions.push(input);
        return { $id: 'next-attempt' };
      },
    },
  };
  try {
    const result = await executeJob(services, { jobId: 'job-1', organizationId: 'team-1' });
    assert.equal(result.status, 'RETRY_WAIT');
    assert.equal(result.attempts, 1);
    assert.deepEqual(result.error, { code: 'AI_NETWORK_ERROR' });
    assert.equal(executions.length, 1);
    assert.ok(new Date(executions[0].scheduledAt).getTime() > Date.now());
    assert.equal(JSON.stringify(result).includes('upstream private details'), false);
  } finally {
    restore();
  }
});

test('a failure after cancellation becomes canceled and never dispatches another attempt', async () => {
  let dispatches = 0;
  const services = {
    tables: jobStore(
      {},
      {
        getResource() {
          throw Object.assign(new Error('temporary failure'), { code: 'AI_NETWORK_ERROR' });
        },
        beforeUpdate(data) {
          if (data.status === 'RETRY_WAIT') return { cancelRequested: true };
        },
      },
    ),
    functions: {
      createExecution: async () => {
        dispatches++;
      },
    },
  };
  const result = await executeJob(services, { jobId: 'job-1', organizationId: 'team-1' });
  assert.equal(result.status, 'CANCELED');
  assert.equal(dispatches, 0);
});

test('task reads atomically recover an expired worker lease and bound recovery attempts', async () => {
  const restore = withWorkerSecret('r'.repeat(40));
  let dispatches = 0;
  const expired = {
    id: 'job-1',
    organizationId: 'team-1',
    type: 'agent.run',
    status: 'RUNNING',
    leaseToken: 'expired-lease',
    leaseExpiresAt: new Date(0).toISOString(),
    attempts: 1,
    maxAttempts: 3,
  };
  const services = (job) => ({
    tables: jobStore(job),
    functions: {
      createExecution: async () => {
        dispatches++;
      },
    },
  });
  try {
    const recovered = await recoverStaleJob(services(expired), expired);
    assert.equal(recovered.status, 'RETRY_WAIT');
    assert.equal(dispatches, 1);
    const exhausted = { ...expired, attempts: 3 };
    const terminal = await recoverStaleJob(services(exhausted), exhausted);
    assert.equal(terminal.status, 'FAILED');
    assert.equal(dispatches, 1);
    const live = await recoverStaleJob(services(expired), {
      ...expired,
      leaseExpiresAt: new Date(Date.now() + 60_000).toISOString(),
    });
    assert.equal(live.status, 'RUNNING');
    assert.equal(dispatches, 1);
  } finally {
    restore();
  }
});

test('cancelling a running job preserves a completion written at the same time', async () => {
  const tables = jobStore(
    { status: 'RUNNING' },
    {
      beforeCommit(data) {
        if (data.cancelRequested) {
          return { status: 'SUCCEEDED', result: JSON.stringify({ content: 'Saved result' }) };
        }
      },
    },
  );
  const result = await cancelJob({ tables }, { teamId: 'team-1' }, 'job-1');
  assert.equal(result.status, 'SUCCEEDED');
  assert.equal(result.cancelRequested, false);
  assert.deepEqual(result.result, { content: 'Saved result' });
});

test('a duplicate delivery leaves an active cancellation with its worker', async () => {
  const tables = jobStore({
    status: 'RUNNING',
    attempts: 1,
    cancelRequested: true,
    leaseExpiresAt: new Date(Date.now() + 60_000).toISOString(),
  });
  const result = await executeJob({ tables }, { jobId: 'job-1', organizationId: 'team-1' });
  assert.equal(result.status, 'RUNNING');
  assert.equal(result.cancelRequested, true);
});

test('an expired worker on the final attempt fails without invoking the job again', async () => {
  const tables = jobStore(
    {
      status: 'RUNNING',
      attempts: 3,
      leaseToken: 'expired-lease',
      leaseExpiresAt: new Date(0).toISOString(),
    },
    {
      getResource: () => assert.fail('An exhausted job must not invoke the worker again'),
    },
  );
  const result = await executeJob({ tables }, { jobId: 'job-1', organizationId: 'team-1' });
  assert.equal(result.status, 'FAILED');
  assert.equal(result.attempts, 3);
  assert.deepEqual(result.error, { code: 'JOB_WORKER_TIMEOUT' });
});

test('a stalled heartbeat cannot block or overwrite a worker settlement', async (context) => {
  context.mock.timers.enable({ apis: ['setInterval'] });
  const payloadStarted = Promise.withResolvers();
  const failPayload = Promise.withResolvers();
  const heartbeatStarted = Promise.withResolvers();
  const resumeHeartbeat = Promise.withResolvers();
  const heartbeatFinished = Promise.withResolvers();
  const tables = jobStore(
    {},
    {
      getResource() {
        payloadStarted.resolve();
        return failPayload.promise;
      },
    },
  );
  const { updateRow, updateTransaction } = tables;
  let heartbeatId;
  tables.updateRow = (input) => {
    if (input.data.heartbeatAt && !input.data.status) heartbeatId = input.transactionId;
    return updateRow(input);
  };
  tables.updateTransaction = async (input) => {
    if (input.transactionId !== heartbeatId || !input.commit) return updateTransaction(input);
    heartbeatStarted.resolve();
    await resumeHeartbeat.promise;
    try {
      return await updateTransaction(input);
    } finally {
      heartbeatFinished.resolve();
    }
  };
  const run = executeJob({ tables }, { jobId: 'job-1', organizationId: 'team-1' });
  await payloadStarted.promise;
  context.mock.timers.tick(120_000);
  await heartbeatStarted.promise;
  failPayload.reject(Object.assign(new Error('Agent is disabled'), { code: 'AGENT_NOT_ACTIVE' }));
  try {
    const result = await run;
    assert.equal(result.status, 'FAILED');
  } finally {
    resumeHeartbeat.resolve();
  }
  await heartbeatFinished.promise;
  const persisted = await tables.getRow({ tableId: 'background_jobs' });
  assert.equal(persisted.status, 'FAILED');
  assert.equal(persisted.leaseToken, '');
  assert.equal(persisted.leaseExpiresAt, new Date(0).toISOString());
});

test('an ambiguous retry dispatch error preserves a worker that already claimed the task', async () => {
  const restore = withWorkerSecret('s'.repeat(40));
  try {
    const tables = jobStore({
      status: 'RUNNING',
      attempts: 1,
      leaseToken: 'expired-lease',
      leaseExpiresAt: new Date(0).toISOString(),
    });
    const result = await recoverStaleJob(
      {
        tables,
        functions: {
          async createExecution() {
            const row = await tables.getRow({ tableId: 'background_jobs' });
            const claimed = await claimJob({ tables }, { id: row.$id, ...row });
            assert.equal(claimed.status, 'RUNNING');
            assert.equal(claimed.attempts, 2);
            throw new Error('Dispatch response lost');
          },
        },
      },
      { id: 'job-1', ...(await tables.getRow({ tableId: 'background_jobs' })) },
    );
    assert.equal(result.status, 'RUNNING');
    assert.equal(result.attempts, 2);
  } finally {
    restore();
  }
});

test('initial response loss leaves the queued row eligible for a delayed worker', async () => {
  const restore = withWorkerSecret('x'.repeat(40));
  try {
    const tables = jobStore({});
    let delivery;
    const services = {
      tables,
      functions: {
        async createExecution({ body }) {
          delivery = JSON.parse(body);
          throw new Error('Response lost');
        },
      },
    };
    const queued = await enqueueJob(services, { teamId: 'team-1', userId: 'user-1' }, 'agent.run', {
      agentId: 'agent-1',
    });
    assert.deepEqual(delivery, { jobId: queued.id, organizationId: 'team-1' });
    assert.equal(queued.status, 'QUEUED');
    assert.equal(queued.error, null);
    const row = await tables.getRow({ tableId: 'background_jobs' });
    const claimed = await claimJob(services, { id: row.$id, ...row });
    assert.equal(claimed.status, 'RUNNING');
    assert.equal(claimed.attempts, 1);
  } finally {
    restore();
  }
});

test('a worker configuration error marks the dispatch failed and preserves the public error code', async () => {
  const restore = withWorkerSecret('');
  try {
    const tables = jobStore({});
    await assert.rejects(
      enqueueJob({ tables }, { teamId: 'team-1', userId: 'user-1' }, 'agent.run', {
        agentId: 'agent-1',
      }),
      { code: 'ASYNC_WORKER_NOT_CONFIGURED' },
    );
    const row = await tables.getRow({ tableId: 'background_jobs' });
    const failed = await getJob({ tables }, 'team-1', row.$id);
    assert.equal(failed.status, 'FAILED');
    assert.deepEqual(failed.error, { code: 'ASYNC_WORKER_NOT_CONFIGURED' });
  } finally {
    restore();
  }
});

test('only one task read re-dispatches a missing execution for an overdue job', async () => {
  const restore = withWorkerSecret('x'.repeat(40));
  let dispatches = 0;
  try {
    for (const status of ['QUEUED', 'RETRY_WAIT']) {
      const tables = jobStore({ status, attempts: status === 'QUEUED' ? 0 : 1 });
      const services = {
        tables,
        functions: {
          async createExecution({ scheduledAt }) {
            assert.equal(scheduledAt, undefined);
            dispatches++;
            throw Object.assign(new Error('Temporary server failure'), { code: 503 });
          },
        },
      };
      const before = dispatches;
      const read = () => getJob(services, 'team-1', 'job-1');
      const results = await Promise.all([read(), read(), read()]);
      assert.ok(results.every((result) => result.status === status));
      assert.equal(dispatches, before + 1);
      assert.equal((await read()).status, status);
      assert.equal(dispatches, before + 1);
      const row = await tables.getRow({ tableId: 'background_jobs' });
      assert.ok(Date.parse(row.leaseExpiresAt) > Date.now());
    }
  } finally {
    restore();
  }
});

test('a legacy lease is kept when a current heartbeat arrives before recovery', async () => {
  const incomingHeartbeat = new Date().toISOString();
  const tables = jobStore(
    { status: 'RUNNING', attempts: 1, startedAt: new Date(0).toISOString() },
    {
      beforeUpdate(data) {
        if (data.status === 'RETRY_WAIT') return { heartbeatAt: incomingHeartbeat };
      },
    },
  );
  const result = await getJob({ tables }, 'team-1', 'job-1');
  assert.equal(result.status, 'RUNNING');
  assert.equal(result.heartbeatAt, incomingHeartbeat);
});

test('a worker delivery settles a historical retry recorded after cancellation', async () => {
  const tables = jobStore({ status: 'RETRY_WAIT', cancelRequested: true, attempts: 1 });
  const result = await executeJob({ tables }, { jobId: 'job-1', organizationId: 'team-1' });
  assert.equal(result.status, 'CANCELED');
  assert.equal(result.attempts, 1);
  assert.ok(result.completedAt);
});
