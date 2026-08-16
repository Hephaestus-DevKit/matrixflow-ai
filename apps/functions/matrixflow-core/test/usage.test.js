import test from 'node:test';
import assert from 'node:assert/strict';
import { recordUsage } from '../src/runtime.js';

test('usage recording keeps raw audit rows and best-effort monthly aggregates', async () => {
  const created = [];
  await recordUsage(
    {
      tables: {
        createRow: async (input) => {
          created.push(input.tableId);
          return { $id: `${input.tableId}-${created.length}`, ...input.data };
        },
      },
    },
    'team-1',
    {
      provider: 'anthropic',
      model: 'claude-test',
      usage: { inputTokens: 12, outputTokens: 8 },
      costUsd: 0.01,
    },
  );
  assert.equal(created.filter((tableId) => tableId === 'usage_records').length, 4);
  assert.equal(created.filter((tableId) => tableId === 'usage_aggregates').length, 6);
});

test('a missing aggregate table does not turn a completed AI call into a retryable failure', async () => {
  await recordUsage(
    {
      tables: {
        createRow: async ({ tableId }) => {
          if (tableId === 'usage_aggregates') throw { code: 404 };
          return { $id: 'raw-row' };
        },
      },
    },
    'team-1',
    { provider: 'openai', model: 'test', usage: { inputTokens: 1, outputTokens: 1 } },
  );
  assert.ok(true);
});
