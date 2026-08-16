import test from 'node:test';
import assert from 'node:assert/strict';
import {
  connectorReadiness,
  validateOutboundUrl,
  validateWebhookConfig,
} from '../src/connectors.js';

const env = {
  NODE_ENV: 'production',
  MATRIXFLOW_CONNECTOR_ALLOWLIST: 'api.example.com,*.trusted.example',
};

test('connector destinations require HTTPS and an explicit host allowlist', () => {
  assert.equal(
    validateOutboundUrl('https://api.example.com/v1/hook', env),
    'https://api.example.com/v1/hook',
  );
  assert.equal(
    validateOutboundUrl('https://eu.trusted.example/hook', env),
    'https://eu.trusted.example/hook',
  );
  assert.throws(
    () => validateOutboundUrl('https://unknown.example/hook', env),
    (error) => error.code === 'CONNECTOR_HOST_NOT_ALLOWED',
  );
  assert.throws(
    () => validateOutboundUrl('http://api.example.com/hook', env),
    (error) => error.code === 'CONNECTOR_URL_INSECURE',
  );
  assert.throws(
    () => validateOutboundUrl('https://127.0.0.1/hook', env),
    (error) => error.code === 'CONNECTOR_URL_PRIVATE',
  );
  assert.throws(
    () =>
      validateOutboundUrl('https://[fd00::1]/hook', {
        ...env,
        MATRIXFLOW_CONNECTOR_ALLOWLIST: '[fd00::1]',
      }),
    (error) => error.code === 'CONNECTOR_URL_PRIVATE',
  );
  assert.throws(
    () =>
      validateOutboundUrl('https://[::ffff:10.0.0.1]/hook', {
        ...env,
        MATRIXFLOW_CONNECTOR_ALLOWLIST: '[::ffff:10.0.0.1]',
      }),
    (error) => error.code === 'CONNECTOR_URL_PRIVATE',
  );
});

test('webhook configuration is bounded before an adapter can send it', () => {
  assert.deepEqual(
    validateWebhookConfig({ url: 'https://api.example.com/leads', method: 'post' }, env),
    { url: 'https://api.example.com/leads', method: 'POST' },
  );
  assert.throws(
    () => validateWebhookConfig({ url: 'https://api.example.com/leads', method: 'GET' }, env),
    (error) => error.code === 'CONNECTOR_METHOD_INVALID',
  );
});

test('connector readiness never reports enabled without an allowlist', () => {
  assert.deepEqual(connectorReadiness({}), {
    configured: false,
    allowlistHosts: 0,
    email: false,
    webhook: false,
  });
});
