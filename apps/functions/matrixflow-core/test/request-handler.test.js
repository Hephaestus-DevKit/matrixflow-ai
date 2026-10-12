import test from 'node:test';
import assert from 'node:assert/strict';
import { HttpError } from '../src/runtime.js';
import { createRequestHandler } from '../src/request-handler.js';

function responseRecorder() {
  const calls = [];
  return {
    calls,
    response: {
      json(payload, status) {
        calls.push({ payload, status });
        return { payload, status };
      },
    },
  };
}

function baseDependencies(overrides = {}) {
  return {
    requestBody: (req) => req.body || {},
    serverClient: () => ({ tables: {} }),
    requireTeamMember: async () => ({ source: 'appwrite-session', roles: ['owner'] }),
    enforceRequestRateLimit: async () => undefined,
    claimIdempotency: async () => ({ claim: { id: 'claim-1' }, replay: null }),
    completeIdempotency: async () => true,
    releaseIdempotency: async () => true,
    ...overrides,
  };
}

function request(body, headers = {}) {
  return {
    path: '/test',
    method: 'POST',
    body,
    headers: {
      'x-appwrite-user-id': 'user-1',
      'x-matrixflow-organization': 'team-1',
      ...headers,
    },
  };
}

test('request failures release an active idempotency claim and preserve the intended error', async () => {
  const released = [];
  const { response, calls } = responseRecorder();
  const handler = createRequestHandler({
    readinessSnapshot: () => ({ ready: true, status: 'ok', checks: {} }),
    handleRoute: async () => {
      throw new HttpError('业务冲突', 409, 'BUSINESS_CONFLICT');
    },
    dependencies: baseDependencies({
      releaseIdempotency: async (_services, teamId, claimId) => {
        released.push({ teamId, claimId });
        return true;
      },
    }),
  });

  await handler({
    req: request({ value: 1 }, { 'idempotency-key': 'request-1234' }),
    res: response,
  });

  assert.deepEqual(released, [{ teamId: 'team-1', claimId: 'claim-1' }]);
  assert.equal(calls[0].status, 409);
  assert.equal(calls[0].payload.error.code, 'BUSINESS_CONFLICT');
});

test('idempotency fingerprints are stable across equivalent JSON key ordering', async () => {
  const fingerprints = [];
  const handler = createRequestHandler({
    readinessSnapshot: () => ({ ready: true, status: 'ok', checks: {} }),
    handleRoute: async () => ({ created: true }),
    dependencies: baseDependencies({
      claimIdempotency: async (_services, _teamId, input) => {
        fingerprints.push(input.fingerprint);
        return { claim: { id: `claim-${fingerprints.length}` }, replay: null };
      },
    }),
  });

  for (const body of [
    { outer: { b: 2, a: 1 }, z: true },
    { z: true, outer: { a: 1, b: 2 } },
  ]) {
    const { response } = responseRecorder();
    await handler({
      req: request(body, { 'idempotency-key': 'request-1234' }),
      res: response,
    });
  }

  assert.equal(fingerprints.length, 2);
  assert.equal(fingerprints[0], fingerprints[1]);
});

test('conflicting organization and idempotency headers fail before business execution', async () => {
  let routed = false;
  const handler = createRequestHandler({
    readinessSnapshot: () => ({ ready: true, status: 'ok', checks: {} }),
    handleRoute: async () => {
      routed = true;
      return {};
    },
    dependencies: baseDependencies(),
  });

  const organizationResponse = responseRecorder();
  await handler({
    req: request({ organizationId: 'team-2' }),
    res: organizationResponse.response,
  });
  assert.equal(organizationResponse.calls[0].payload.error.code, 'ORGANIZATION_MISMATCH');

  const idempotencyResponse = responseRecorder();
  await handler({
    req: request({ __idempotencyKey: 'request-body' }, { 'idempotency-key': 'request-header' }),
    res: idempotencyResponse.response,
  });
  assert.equal(idempotencyResponse.calls[0].payload.error.code, 'IDEMPOTENCY_KEY_MISMATCH');
  assert.equal(routed, false);
});

test('rejects an explicitly non-JSON request before authentication or routing', async () => {
  let routed = false;
  const handler = createRequestHandler({
    readinessSnapshot: () => ({ ready: true, status: 'ok', checks: {} }),
    handleRoute: async () => {
      routed = true;
      return {};
    },
    dependencies: baseDependencies(),
  });
  const { response, calls } = responseRecorder();
  await handler({
    req: request({ value: 1 }, { 'content-type': 'text/plain' }),
    res: response,
  });
  assert.equal(calls[0].status, 415);
  assert.equal(calls[0].payload.error.code, 'UNSUPPORTED_MEDIA_TYPE');
  assert.equal(routed, false);
});

test('idempotent replays are bound to the caller and current permissions', async () => {
  const fingerprints = [];
  let roles = ['owner'];
  const handler = createRequestHandler({
    readinessSnapshot: () => ({}),
    handleRoute: async () => ({ created: true }),
    dependencies: baseDependencies({
      requireTeamMember: async () => ({ roles }),
      resolveApiKey: async () => ({
        source: 'api-key',
        userId: 'user-1',
        apiKeyId: 'key-1',
        capabilities: ['agents.manage'],
      }),
      claimIdempotency: async (_services, _teamId, input) => {
        fingerprints.push(input.fingerprint);
        return { claim: { id: 'claim-1' } };
      },
    }),
  });
  for (const headers of [
    {},
    { 'x-appwrite-user-id': 'user-2' },
    { authorization: 'Bearer mf_live_test-key' },
  ]) {
    await handler({
      req: request({}, { ...headers, 'idempotency-key': 'same-key-1234' }),
      res: responseRecorder().response,
    });
  }
  roles = ['member'];
  await handler({
    req: request({}, { 'idempotency-key': 'same-key-1234' }),
    res: responseRecorder().response,
  });
  assert.equal(new Set(fingerprints).size, 4);
});

test('API key creation returns the secret once but never stores it in an idempotent response', async () => {
  let stored;
  const handler = createRequestHandler({
    readinessSnapshot: () => ({}),
    handleRoute: async () => ({ key: 'mf_live_plaintext-secret', metadata: { id: 'key-1' } }),
    dependencies: baseDependencies({
      claimIdempotency: async () =>
        stored ? { replay: stored.payload, status: stored.status } : { claim: { id: 'claim-1' } },
      completeIdempotency: async (_services, _teamId, _claimId, payload, status) => {
        stored = { payload, status };
        return true;
      },
    }),
  });
  const req = { ...request({}, { 'idempotency-key': 'api-key-1234' }), path: '/api-keys' };
  const first = responseRecorder();
  await handler({ req, res: first.response });
  assert.equal(first.calls[0].status, 200);
  assert.equal(first.calls[0].payload.data.key, 'mf_live_plaintext-secret');
  assert.ok(!JSON.stringify(stored).includes('mf_live_plaintext-secret'));
  const retry = responseRecorder();
  await handler({ req, res: retry.response });
  assert.equal(retry.calls[0].status, 409);
  assert.equal(retry.calls[0].payload.error.code, 'API_KEY_SECRET_UNAVAILABLE');
});
