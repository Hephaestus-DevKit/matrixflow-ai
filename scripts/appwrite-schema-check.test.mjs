import test from 'node:test';
import assert from 'node:assert/strict';
import { validateSchema } from './appwrite-schema-check.mjs';

test('schema checker catches duplicate IDs and unknown index columns', () => {
  const result = validateSchema([
    {
      $id: 'agents',
      rowSecurity: true,
      $permissions: ['create("users")'],
      columns: [{ key: 'organizationId' }],
      indexes: [{ key: 'bad', columns: ['missing'] }],
    },
    { $id: 'agents', rowSecurity: true, columns: [] },
  ]);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes('unique')));
  assert.ok(result.errors.some((error) => error.includes('unknown column')));
  assert.ok(result.errors.some((error) => error.includes('permissions must stay empty')));
});

test('schema checker requires tenant columns and concurrency-critical unique indexes', () => {
  const result = validateSchema([
    {
      $id: 'usage_counters',
      rowSecurity: true,
      $permissions: [],
      columns: [{ key: 'bucket' }, { key: 'used' }],
      indexes: [],
    },
  ]);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes('missing tenant boundary')));
  assert.ok(result.errors.some((error) => error.includes('missing required unique index')));
});
