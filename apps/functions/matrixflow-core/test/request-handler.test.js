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
