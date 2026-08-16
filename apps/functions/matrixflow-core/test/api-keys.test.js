import test from 'node:test';
import assert from 'node:assert/strict';
import {
  API_KEY_SCOPES,
  createApiKey,
  generateApiKey,
  resolveApiKey,
  validateApiKeySecret,
} from '../src/api-keys.js';
import { pbkdf2Sync } from 'node:crypto';

test('generated API keys are high entropy and never return the hash as the secret', () => {
  const generated = generateApiKey();
  assert.match(generated.secret, /^mf_live_[A-Za-z0-9_-]{43}$/);
  assert.equal(generated.keyPrefix, generated.secret.slice(0, 17));
  assert.equal(
    generated.keyHash,
    pbkdf2Sync(generated.secret, 'matrixflow-development-only', 120_000, 32, 'sha256').toString(
      'hex',
    ),
  );
  assert.throws(
    () => validateApiKeySecret('mf_live_short'),
    (error) => error.code === 'API_KEY_INVALID',
  );
});

test('API key creation validates scopes and returns the secret only once', async () => {
  const created = [];
  const services = {
    tables: {
      createRow: async ({ rowId, data }) => {
        created.push(data);
        return { $id: rowId, ...data };
      },
    },
  };
  const result = await createApiKey(
    services,
    { teamId: 'team-1', userId: 'user-1' },
    { name: 'CI', scopes: ['agents.manage', 'workflows.manage'] },
  );
  assert.match(result.key, /^mf_live_/);
  assert.equal(result.metadata.keyHash, undefined);
  assert.deepEqual(created[0].scopes, JSON.stringify(['agents.manage', 'workflows.manage']));
  await assert.rejects(
    () =>
      createApiKey(
        services,
        { teamId: 'team-1', userId: 'user-1' },
        { name: 'Bad', scopes: ['root'] },
      ),
    (error) => error.code === 'API_KEY_SCOPES_INVALID',
  );
  assert.ok(API_KEY_SCOPES.includes('knowledge.manage'));
});

test('API key expiry must be future-dated and bounded', async () => {
  const services = {
    tables: {
      createRow: async ({ rowId, data }) => ({ $id: rowId, ...data }),
    },
  };
  const context = { teamId: 'team-1', userId: 'user-1' };
  await assert.rejects(
    () =>
      createApiKey(services, context, {
        name: 'expired',
        scopes: ['agents.manage'],
        expiresAt: new Date(Date.now() - 1_000).toISOString(),
      }),
    (error) => error.code === 'API_KEY_EXPIRY_INVALID',
  );
  await assert.rejects(
    () =>
      createApiKey(services, context, {
        name: 'too-far',
        scopes: ['agents.manage'],
        expiresAt: new Date(Date.now() + 3 * 365 * 24 * 60 * 60 * 1_000).toISOString(),
      }),
    (error) => error.code === 'API_KEY_EXPIRY_INVALID',
  );
});

test('API key resolution is tenant-bound, expiry-aware, and scope preserving', async () => {
  const secret = generateApiKey();
  const row = {
    $id: 'key-1',
    organizationId: 'team-1',
    keyPrefix: secret.keyPrefix,
    keyHash: secret.keyHash,
    scopes: JSON.stringify(['agents.manage']),
    createdBy: 'user-1',
  };
  const services = {
    tables: {
      listRows: async () => ({ total: 1, rows: [row] }),
      getRow: async () => row,
      updateRow: async ({ data }) => ({ ...row, ...data }),
    },
  };
  const resolved = await resolveApiKey(services, 'team-1', secret.secret);
  assert.deepEqual(resolved, {
    source: 'api-key',
    roles: ['api'],
    capabilities: ['agents.manage'],
    userId: 'user-1',
    apiKeyId: 'key-1',
  });
  await assert.rejects(
    () => resolveApiKey(services, 'another-team', secret.secret),
    (error) => error.code === 'API_KEY_INVALID',
  );
});
