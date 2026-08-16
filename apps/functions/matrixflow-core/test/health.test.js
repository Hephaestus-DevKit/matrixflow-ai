import test from 'node:test';
import assert from 'node:assert/strict';
import { readinessSnapshot } from '../src/main.js';

test('readiness exposes degraded optional dependencies without leaking credentials', () => {
  const previous = {
    provider: process.env.MATRIXFLOW_REQUIRE_PROVIDER,
    async: process.env.MATRIXFLOW_REQUIRE_ASYNC,
    billing: process.env.MATRIXFLOW_REQUIRE_BILLING,
    worker: process.env.MATRIXFLOW_WORKER_SECRET,
  };
  delete process.env.MATRIXFLOW_REQUIRE_PROVIDER;
  delete process.env.MATRIXFLOW_REQUIRE_ASYNC;
  delete process.env.MATRIXFLOW_REQUIRE_BILLING;
  delete process.env.MATRIXFLOW_WORKER_SECRET;
  try {
    const result = readinessSnapshot();
    assert.equal(result.ready, true);
    assert.equal(result.status, 'degraded');
    assert.equal(result.checks.provider.configured, false);
    assert.equal(result.checks.asyncWorker.configured, false);
    assert.equal(result.ai.providers.length, 0);
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      const envKey =
        key === 'provider'
          ? 'MATRIXFLOW_REQUIRE_PROVIDER'
          : key === 'async'
            ? 'MATRIXFLOW_REQUIRE_ASYNC'
            : key === 'billing'
              ? 'MATRIXFLOW_REQUIRE_BILLING'
              : 'MATRIXFLOW_WORKER_SECRET';
      if (value === undefined) delete process.env[envKey];
      else process.env[envKey] = value;
    }
  }
});
