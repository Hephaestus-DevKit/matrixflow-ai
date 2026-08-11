import test from 'node:test';
import assert from 'node:assert/strict';
import { parse, schemas } from '../src/schemas.js';
import { requireAdmin, requireCapability } from '../src/runtime.js';

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
