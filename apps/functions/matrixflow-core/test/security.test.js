import test from 'node:test';
import assert from 'node:assert/strict';
import { parse, schemas } from '../src/schemas.js';
import {
  getOwned,
  requestBody,
  requireAdmin,
  requireCapability,
  requireTeamMember,
  rowPermissions,
  enforceResourceLimit,
  enforceRequestRateLimit,
  reservePlanResourceLimit,
  reserveUsageCounter,
} from '../src/runtime.js';
import { chunkBelongsToCurrentIndex, deleteAgent, splitTextIntoChunks } from '../src/features.js';
import { billingSignature, isValidBillingSignature } from '../src/billing.js';
import { estimateCostUsd } from '../src/provider.js';
import { subscriptionEntitled } from '../src/billing.js';

test('agent updates reject mass-assignment fields', () => {
  assert.throws(
    () => parse(schemas.agentUpdate, { name: 'Support', organizationId: 'another-team' }),
    (error) => error.code === 'VALIDATION_ERROR',
  );
});

test('customer input requires at least one identity field', () => {
  assert.throws(
    () => parse(schemas.customer, {}),
    (error) => error.code === 'VALIDATION_ERROR',
  );
  assert.equal(parse(schemas.customer, { email: 'hello@example.com' }).email, 'hello@example.com');
});

test('billing upgrade requests are bounded and reject mass assignment', () => {
  assert.deepEqual(parse(schemas.billingRequest, { requestedPlan: 'pro' }), {
    requestedPlan: 'pro',
    requestedSeats: 1,
    note: '',
  });
  assert.throws(
    () => parse(schemas.billingRequest, { requestedPlan: 'pro', organizationId: 'other-team' }),
    (error) => error.code === 'VALIDATION_ERROR',
  );
  assert.throws(
    () => parse(schemas.billingRequest, { requestedPlan: 'enterprise', requestedSeats: 1 }),
    (error) => error.code === 'VALIDATION_ERROR',
  );
  assert.throws(
    () => parse(schemas.billingRequest, { requestedPlan: 'team', requestedSeats: 501 }),
    (error) => error.code === 'VALIDATION_ERROR',
  );
});

test('members can manage core resources but cannot access admin routes', () => {
  const member = { roles: ['member'] };
  assert.doesNotThrow(() => requireCapability(member, 'knowledge.manage'));
  assert.throws(
    () => requireAdmin(member),
    (error) => error.code === 'ADMIN_REQUIRED',
  );
});

test('owners can access admin routes', () => {
  assert.doesNotThrow(() => requireAdmin({ roles: ['owner'] }));
});

test('tenant rows expose read-only permissions to browser clients', () => {
  assert.deepEqual(rowPermissions('team-1', 'agents'), ['read("team:team-1")']);
  assert.deepEqual(rowPermissions('team-1', 'audit_logs'), []);
  assert.deepEqual(rowPermissions('team-1', 'usage_counters'), []);
});

test('AI quota reservations use atomic increments and enforce the database maximum', async () => {
  let increments = 0;
  const services = {
    tables: {
      createRow: async () => {
        throw { status: 409 };
      },
      incrementRowColumn: async ({ value, max }) => {
        increments += 1;
        assert.equal(value, 2);
        assert.equal(max, 10);
        return { $id: 'counter-1', organizationId: 'team-1', used: 8, limit: 10 };
      },
    },
  };
  const reserved = await reserveUsageCounter(services, 'team-1', {
    bucket: 'month:2026-08',
    amount: 2,
    limit: 10,
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    code: 'AI_MONTHLY_QUOTA_EXCEEDED',
    message: 'quota reached',
  });
  assert.equal(reserved.used, 8);
  assert.equal(increments, 1);

  services.tables.incrementRowColumn = async () => {
    throw { status: 409, message: 'maximum value exceeded' };
  };
  await assert.rejects(
    () =>
      reserveUsageCounter(services, 'team-1', {
        bucket: 'month:2026-08',
        amount: 2,
        limit: 10,
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        code: 'AI_MONTHLY_QUOTA_EXCEEDED',
        message: 'quota reached',
      }),
    (error) => error.code === 'AI_MONTHLY_QUOTA_EXCEEDED' && error.status === 429,
  );
});

test('ordinary API requests receive a tenant and principal scoped atomic limit', async () => {
  const created = [];
  const services = {
    tables: {
      createRow: async (input) => {
        created.push(input);
        return { $id: input.rowId, ...input.data };
      },
      listRows: async () => ({ total: 0, rows: [] }),
      deleteRow: async () => undefined,
    },
  };
  const result = await enforceRequestRateLimit(services, 'team-rate', 'user:user-1', {
    MATRIXFLOW_REQUESTS_PER_MINUTE: '60',
  });
  assert.equal(result.limit, 60);
  assert.equal(result.used, 1);
  assert.equal(created[0].tableId, 'usage_counters');
  assert.match(created[0].data.bucket, /^request:[a-f0-9]{16}:/);
});

test('deleting an agent removes tenant-owned run history before the parent row', async () => {
  const deleted = [];
  const created = [];
  const services = {
    tables: {
      listRows: async ({ tableId }) =>
        tableId === 'agent_runs'
          ? {
              total: 2,
              rows: [
                { $id: 'run-1', organizationId: 'team-1', agentId: 'agent-1' },
                { $id: 'run-2', organizationId: 'team-1', agentId: 'agent-1' },
              ],
            }
          : { total: 0, rows: [] },
      getRow: async ({ tableId, rowId }) => ({
        $id: rowId,
        organizationId: 'team-1',
        ...(tableId === 'agents' ? { name: 'Smoke agent' } : {}),
      }),
      deleteRow: async ({ tableId, rowId }) => {
        deleted.push(`${tableId}:${rowId}`);
      },
      createRow: async (input) => {
        created.push(input);
        return { $id: input.rowId, ...input.data };
      },
    },
  };

  const result = await deleteAgent(services, { teamId: 'team-1', userId: 'user-1' }, 'agent-1');

  assert.deepEqual(result, { deleted: true, deletedRuns: 2 });
  assert.deepEqual(deleted.slice(0, 2).sort(), ['agent_runs:run-1', 'agent_runs:run-2']);
  assert.equal(deleted[2], 'agents:agent-1');
  assert.equal(created[0].tableId, 'audit_logs');
  assert.equal(JSON.parse(created[0].data.metadata).deletedRuns, 2);
});

test('knowledge chunks stay below the Appwrite row byte limit', () => {
  const text = '跨境产品资料 '.repeat(10_000);
  const chunks = splitTextIntoChunks(text, 24_000);
  assert.ok(chunks.length > 1);
  assert.ok(chunks.every((chunk) => Buffer.byteLength(chunk.content, 'utf8') <= 24_000));
  assert.ok(chunks.every((chunk) => chunk.content.length > 0));
});

test('knowledge retrieval only reads the document current index version', () => {
  assert.equal(
    chunkBelongsToCurrentIndex({ indexVersion: 'version-2' }, { indexVersion: 'version-2' }),
    true,
  );
  assert.equal(
    chunkBelongsToCurrentIndex({ indexVersion: 'version-1' }, { indexVersion: 'version-2' }),
    false,
  );
  assert.equal(chunkBelongsToCurrentIndex({}, {}), true);
  assert.equal(chunkBelongsToCurrentIndex({ indexVersion: 'version-1' }, {}), false);
});

test('pre-parsed request bodies keep the same size guard', () => {
  assert.throws(
    () => requestBody({ bodyJson: { prompt: 'x'.repeat(128 * 1024) } }),
    (error) => error.code === 'BODY_TOO_LARGE',
  );
});

test('request bodies must be JSON objects', () => {
  assert.throws(
    () => requestBody({ bodyJson: ['unexpected-array'] }),
    (error) => error.code === 'INVALID_JSON',
  );
  assert.throws(
    () => requestBody({ bodyText: 'null' }),
    (error) => error.code === 'INVALID_JSON',
  );
});

test('owned rows cannot be moved to another team during update', async () => {
  const services = {
    tables: {
      getRow: async () => ({ $id: 'row-1', organizationId: 'team-1' }),
      updateRow: async () => ({ $id: 'row-1', organizationId: 'team-1' }),
    },
  };
  const { updateOwned } = await import('../src/runtime.js');
  await assert.rejects(
    () => updateOwned(services, 'agents', 'row-1', 'team-1', { organizationId: 'team-2' }),
    (error) => error.code === 'ORGANIZATION_IMMUTABLE',
  );
});

test('missing tenant rows return a stable 404 instead of leaking Appwrite errors', async () => {
  await assert.rejects(
    () =>
      getOwned(
        {
          tables: { getRow: async () => Promise.reject({ code: 404, message: 'internal detail' }) },
        },
        'agents',
        'missing',
        'team-1',
      ),
    (error) => error.code === 'RESOURCE_NOT_FOUND' && error.status === 404,
  );
});

test('unknown teams never expose Appwrite membership details', async () => {
  await assert.rejects(
    () =>
      requireTeamMember(
        {
          teams: { listMemberships: async () => Promise.reject({ code: 404, message: 'secret' }) },
        },
        'team-1',
        'user-1',
      ),
    (error) => error.code === 'FORBIDDEN' && error.status === 403,
  );
});

test('plan limits fail before creating another resource', async () => {
  await assert.rejects(
    () =>
      enforceResourceLimit(
        { tables: { listRows: async () => ({ total: 3, rows: [] }) } },
        'workflows',
        'team-1',
        3,
        [],
        '工作流',
      ),
    (error) => error.code === 'PLAN_LIMIT_EXCEEDED' && error.status === 403,
  );
});

test('plan resource reservations reject a concurrent create at the atomic maximum', async () => {
  let counterUsed = 0;
  let counterCreated = false;
  const services = {
    tables: {
      listRows: async ({ tableId }) => {
        if (tableId === 'subscriptions') return { total: 0, rows: [] };
        return { total: 0, rows: [] };
      },
      createRow: async ({ tableId, data }) => {
        if (tableId !== 'usage_counters') return { $id: 'resource-1', ...data };
        if (counterCreated) throw { code: 409 };
        counterCreated = true;
        counterUsed = Number(data.used);
        return { $id: 'counter-1', ...data };
      },
      incrementRowColumn: async ({ max }) => {
        if (counterUsed + 1 > max) throw { code: 409, message: 'maximum' };
        counterUsed += 1;
        return { $id: 'counter-1', used: counterUsed };
      },
    },
  };
  const previousLimit = process.env.MATRIXFLOW_WORKFLOW_LIMIT;
  process.env.MATRIXFLOW_WORKFLOW_LIMIT = '1';
  let results;
  try {
    results = await Promise.allSettled([
      reservePlanResourceLimit(services, 'team-1', 'workflowLimit', 1, '工作流'),
      reservePlanResourceLimit(services, 'team-1', 'workflowLimit', 1, '工作流'),
    ]);
  } finally {
    if (previousLimit === undefined) delete process.env.MATRIXFLOW_WORKFLOW_LIMIT;
    else process.env.MATRIXFLOW_WORKFLOW_LIMIT = previousLimit;
  }
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
  assert.equal(
    results.find((result) => result.status === 'rejected').reason.code,
    'PLAN_LIMIT_EXCEEDED',
  );
});

test('billing webhook signatures are exact and timing-safe', () => {
  const body = '{"eventId":"evt_1"}';
  const signature = billingSignature(body, 'test-secret');
  assert.equal(isValidBillingSignature(body, signature, 'test-secret'), true);
  assert.equal(isValidBillingSignature(body, `sha256=${signature}`, 'test-secret'), true);
  assert.equal(isValidBillingSignature(`${body} `, signature, 'test-secret'), false);
  assert.equal(isValidBillingSignature(body, signature, 'wrong-secret'), false);
});

test('billing webhook payloads are bounded to known subscription states', () => {
  const parsed = parse(schemas.billingWebhook, {
    eventId: 'evt_1',
    organizationId: 'team_1',
    provider: 'stripe',
    type: 'subscription.updated',
    subscriptionId: 'sub_1',
    planId: 'pro',
    status: 'active',
  });
  assert.equal(parsed.seats, 1);
  assert.throws(
    () => parse(schemas.billingWebhook, { ...parsed, status: 'not-a-status' }),
    (error) => error.code === 'VALIDATION_ERROR',
  );
  assert.throws(
    () => parse(schemas.billingWebhook, { ...parsed, organizationId: 'other', secret: 'leak' }),
    (error) => error.code === 'VALIDATION_ERROR',
  );
});

test('billing entitlement distinguishes active/trialing from delinquent subscriptions', () => {
  assert.equal(subscriptionEntitled({ status: 'active' }), true);
  assert.equal(subscriptionEntitled({ status: 'trialing' }), true);
  assert.equal(subscriptionEntitled({ status: 'past_due' }), false);
  assert.equal(
    subscriptionEntitled({ status: 'active', currentPeriodEnd: '2020-01-01T00:00:00.000Z' }),
    false,
  );
});

test('provider cost estimation remains zero until prices are configured', () => {
  assert.equal(
    estimateCostUsd(
      'openai',
      'gpt-test',
      { inputTokens: 1_000, outputTokens: 2_000 },
      { MATRIXFLOW_AI_PRICING_JSON: '{"openai:gpt-test":{"inputPer1k":0.01,"outputPer1k":0.02}}' },
    ),
    0.05,
  );
  assert.equal(estimateCostUsd('openai', 'gpt-test', { inputTokens: 1 }, {}), 0);
});

test('run retry metadata is bounded and strict', () => {
  assert.deepEqual(parse(schemas.agentRun, { input: {}, retryCount: 2 }), {
    input: {},
    retryCount: 2,
    mode: 'sync',
  });
  assert.throws(
    () => parse(schemas.workflowRun, { input: {}, retryCount: 11 }),
    (error) => error.code === 'VALIDATION_ERROR',
  );
});
