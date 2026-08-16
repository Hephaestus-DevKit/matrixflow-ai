import test from 'node:test';
import assert from 'node:assert/strict';
import { auditConfig } from './production-config-audit.mjs';

test('non-strict audit allows controlled preview configuration but reports warnings', () => {
  const result = auditConfig({ NODE_ENV: 'production' }, { strict: false });
  assert.equal(result.ready, true);
  assert.equal(result.checks.find((check) => check.name === 'ai-provider').required, false);
});

test('strict audit requires provider, worker, billing, alerting, backup, and deployment evidence', () => {
  const result = auditConfig(
    {
      NODE_ENV: 'production',
      MATRIXFLOW_AI_PROVIDER: 'anthropic',
      ANTHROPIC_API_KEY: 'secret',
      MATRIXFLOW_WORKER_SECRET: 'x'.repeat(40),
      MATRIXFLOW_BILLING_PROVIDER: 'stripe',
      MATRIXFLOW_BILLING_WEBHOOK_SECRET: 'billing-secret',
      STRIPE_SECRET_KEY: 'sk_live_secret',
      STRIPE_PRICE_PRO: 'price_pro',
      STRIPE_PRICE_TEAM: 'price_team',
      STRIPE_WEBHOOK_SECRET: 'whsec_test_secret',
      MATRIXFLOW_CONNECTOR_ALLOWLIST: 'api.example.com',
      MATRIXFLOW_ALERT_WEBHOOK_URL: 'https://alerts.example.com/hook',
      MATRIXFLOW_BACKUP_EVIDENCE_URL: 'https://ops.example.com/backups/2026-08-16',
      MATRIXFLOW_BACKUP_LAST_SUCCESS_AT: new Date().toISOString(),
      MATRIXFLOW_RESTORE_EVIDENCE_URL: 'https://ops.example.com/restores/2026-08-16',
      MATRIXFLOW_RESTORE_LAST_SUCCESS_AT: new Date().toISOString(),
      MATRIXFLOW_DEPLOY_KEY: 'deploy-key',
    },
    { strict: true },
  );
  assert.equal(result.ready, true);
});

test('strict audit rejects unsafe production overrides', () => {
  const result = auditConfig(
    {
      NODE_ENV: 'production',
      MATRIXFLOW_ALLOW_PRIVATE_PROVIDER: 'true',
    },
    { strict: true },
  );
  assert.equal(result.ready, false);
  assert.equal(result.checks.find((check) => check.name === 'production-safety').ok, false);
});

test('strict audit rejects stale or non-HTTPS operational evidence', () => {
  const result = auditConfig(
    {
      NODE_ENV: 'production',
      MATRIXFLOW_ALERT_WEBHOOK_URL: 'http://alerts.example.com/hook',
      MATRIXFLOW_BACKUP_EVIDENCE_URL: 'https://ops.example.com/backups/old',
      MATRIXFLOW_BACKUP_LAST_SUCCESS_AT: '2020-01-01T00:00:00.000Z',
      MATRIXFLOW_RESTORE_EVIDENCE_URL: 'https://ops.example.com/restores/old',
      MATRIXFLOW_RESTORE_LAST_SUCCESS_AT: '2020-01-01T00:00:00.000Z',
    },
    { strict: true },
  );
  assert.equal(result.ready, false);
  assert.equal(result.checks.find((check) => check.name === 'alerting').ok, false);
  assert.equal(result.checks.find((check) => check.name === 'backup-evidence').ok, false);
  assert.equal(result.checks.find((check) => check.name === 'restore-evidence').ok, false);
});
