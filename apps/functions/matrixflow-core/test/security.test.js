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
} from '../src/runtime.js';
import { deleteAgent, splitTextIntoChunks } from '../src/features.js';
import { billingSignature, isValidBillingSignature } from '../src/billing.js';
import { estimateCostUsd } from '../src/provider.js';

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
    () => parse(schemas.billingWebhook, { ...parsed, status: 'past_due' }),
    (error) => error.code === 'VALIDATION_ERROR',
  );
  assert.throws(
    () => parse(schemas.billingWebhook, { ...parsed, organizationId: 'other', secret: 'leak' }),
    (error) => error.code === 'VALIDATION_ERROR',
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
  });
  assert.throws(
    () => parse(schemas.workflowRun, { input: {}, retryCount: 11 }),
    (error) => error.code === 'VALIDATION_ERROR',
  );
});
