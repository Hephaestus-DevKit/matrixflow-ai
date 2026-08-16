import test from 'node:test';
import assert from 'node:assert/strict';
import { handleSystemRoute } from '../src/routes/system.js';

function routeInput(membership) {
  return {
    services: {},
    context: { teamId: 'team-1', userId: 'user-1', requestId: 'request-1' },
    membership,
    path: '/admin/health',
    segments: ['admin', 'health'],
    method: 'GET',
    body: {},
    ai: { ready: false },
    readinessSnapshot: () => ({
      ready: true,
      status: 'degraded',
      checks: {
        function: { status: 'ok' },
        provider: { status: 'degraded', configured: false, required: false },
      },
      ai: { ready: false, providers: [] },
    }),
  };
}

test('admin health exposes non-secret readiness to an owner', async () => {
  const result = await handleSystemRoute(routeInput({ roles: ['owner'] }));
  assert.equal(result.status, 'degraded');
  assert.equal(result.service, 'matrixflow-core');
  assert.equal(result.requestId, 'request-1');
  assert.equal(result.checks.provider.configured, false);
  assert.equal(result.ai.ready, false);
  assert.equal(JSON.stringify(result).includes('secret'), false);
});

test('admin health remains server-authorized for ordinary members and API keys', async () => {
  await assert.rejects(
    () => handleSystemRoute(routeInput({ roles: ['member'] })),
    (error) => error?.code === 'ADMIN_REQUIRED' && error?.status === 403,
  );
  await assert.rejects(
    () => handleSystemRoute(routeInput({ source: 'api-key', roles: ['api'] })),
    (error) => error?.code === 'ADMIN_REQUIRED' && error?.status === 403,
  );
});
