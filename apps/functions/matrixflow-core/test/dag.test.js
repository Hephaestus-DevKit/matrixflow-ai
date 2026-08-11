import test from 'node:test';
import assert from 'node:assert/strict';
import { edgeAllows, evaluateCondition, interpolate, validateDag } from '../src/dag.js';

test('orders a valid DAG', () => {
  const result = validateDag({
    nodes: [
      { id: 'start', type: 'trigger' },
      { id: 'write', type: 'ai' },
    ],
    edges: [{ source: 'start', target: 'write' }],
  });
  assert.deepEqual(
    result.order.map((node) => node.id),
    ['start', 'write'],
  );
});

test('rejects cycles', () => {
  assert.throws(
    () =>
      validateDag({
        nodes: [
          { id: 'a', type: 'trigger' },
          { id: 'b', type: 'ai' },
        ],
        edges: [
          { source: 'a', target: 'b' },
          { source: 'b', target: 'a' },
        ],
      }),
    /循环依赖/,
  );
});

test('interpolates nested values without executing code', () => {
  assert.equal(
    interpolate('Hello {{customer.name}}', { customer: { name: 'MatrixFlow' } }),
    'Hello MatrixFlow',
  );
});

test('evaluates typed conditions instead of treating "false" as truthy', () => {
  assert.equal(
    evaluateCondition(
      { field: 'input.enabled', operator: 'eq', value: 'false' },
      { input: { enabled: false } },
    ),
    true,
  );
  assert.equal(
    evaluateCondition(
      { field: 'input.score', operator: 'gte', value: '0.8' },
      { input: { score: 0.9 } },
    ),
    true,
  );
});

test('selects true and false workflow branches', () => {
  assert.equal(edgeAllows({ condition: 'true' }, true), true);
  assert.equal(edgeAllows({ condition: 'false' }, true), false);
  assert.equal(edgeAllows({ condition: 'falsy' }, false), true);
});
