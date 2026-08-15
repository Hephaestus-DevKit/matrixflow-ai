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
} from '../src/runtime.js';
import { splitTextIntoChunks } from '../src/features.js';

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
