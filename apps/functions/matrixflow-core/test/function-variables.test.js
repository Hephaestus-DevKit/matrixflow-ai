import test from 'node:test';
import assert from 'node:assert/strict';
import { listAllFunctionVariables } from '../scripts/function-variables.mjs';

function fixture(count) {
  const variables = Array.from({ length: count }, (_, i) => ({
    $id: `variable-${i}`,
    key: i === count - 1 ? 'DEEPSEEK_BASE_URL' : `CONFIG_${i}`,
    secret: true,
  }));
  const calls = [];
  return {
    variables,
    calls,
    functions: {
      async listVariables({ functionId, queries = [] }) {
        assert.equal(functionId, 'matrixflow-core');
        calls.push(queries);
        const parsed = queries.map((query) => JSON.parse(query));
        const limit = parsed.find((query) => query.method === 'limit')?.values[0] || 25;
        const cursor = parsed.find((query) => query.method === 'cursorAfter')?.values[0];
        const start = cursor ? variables.findIndex((variable) => variable.$id === cursor) + 1 : 0;
        return { total: count, variables: variables.slice(start, start + limit) };
      },
    },
  };
}

test('finds existing provider variables beyond the default 25 results', async () => {
  const { functions, variables } = fixture(30);
  const result = await listAllFunctionVariables(functions, 'matrixflow-core');
  assert.deepEqual(result, variables);
  assert.equal(result.find((variable) => variable.key === 'DEEPSEEK_BASE_URL').secret, true);
});

test('follows cursors when variables exceed one explicitly requested page', async () => {
  const { functions, variables, calls } = fixture(101);
  assert.deepEqual(await listAllFunctionVariables(functions, 'matrixflow-core'), variables);
  assert.equal(calls.length, 2);
});

test('accepts an empty variable list', async () => {
  const { functions } = fixture(0);
  assert.deepEqual(await listAllFunctionVariables(functions, 'matrixflow-core'), []);
});
