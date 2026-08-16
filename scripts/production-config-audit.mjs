import { configuredProviders } from '../apps/functions/matrixflow-core/src/provider.js';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const boolean = (value) => String(value || '').toLowerCase() === 'true';
const present = (value) => typeof value === 'string' && value.trim().length > 0;
const httpsUrl = (value) => {
  try {
    return new URL(String(value)).protocol === 'https:';
  } catch {
    return false;
  }
};

function recentTimestamp(value, maxAgeMs, now = Date.now()) {
  const timestamp = Date.parse(String(value || ''));
  return Number.isFinite(timestamp) && timestamp <= now && now - timestamp <= maxAgeMs;
}

export function auditConfig(env = process.env, { strict = false } = {}) {
  const production = String(env.NODE_ENV || '').toLowerCase() === 'production';
  const checks = [];
  let providerNames = [];
  try {
    providerNames = configuredProviders(env).map((provider) => provider.name);
  } catch {
    providerNames = [];
  }
  checks.push({
    name: 'ai-provider',
    required: strict || boolean(env.MATRIXFLOW_REQUIRE_PROVIDER),
    ok: providerNames.length > 0,
    detail: providerNames.length ? providerNames.join(',') : 'no provider key configured',
  });

  const workerReady =
    present(env.MATRIXFLOW_WORKER_SECRET) && env.MATRIXFLOW_WORKER_SECRET.length >= 32;
  checks.push({
    name: 'async-worker',
    required: strict || boolean(env.MATRIXFLOW_REQUIRE_ASYNC),
    ok: workerReady,
    detail: workerReady ? 'secret configured' : 'MATRIXFLOW_WORKER_SECRET missing or too short',
  });

  const apiKeyPepperReady =
    present(env.MATRIXFLOW_API_KEY_PEPPER) && env.MATRIXFLOW_API_KEY_PEPPER.length >= 32;
  checks.push({
    name: 'api-key-pepper',
    required: strict,
    ok: apiKeyPepperReady,
    detail: apiKeyPepperReady
      ? 'API Key HMAC pepper configured'
      : 'MATRIXFLOW_API_KEY_PEPPER missing or too short',
  });

  const billingConfigured = present(env.MATRIXFLOW_BILLING_PROVIDER);
  const stripeReady =
    env.MATRIXFLOW_BILLING_PROVIDER !== 'stripe' ||
    (present(env.STRIPE_SECRET_KEY) &&
      (String(env.NODE_ENV || '').toLowerCase() !== 'production' ||
        env.STRIPE_SECRET_KEY.startsWith('sk_live_') ||
        boolean(env.MATRIXFLOW_ALLOW_TEST_BILLING)) &&
      present(env.STRIPE_PRICE_PRO) &&
      present(env.STRIPE_PRICE_TEAM) &&
      present(env.STRIPE_WEBHOOK_SECRET));
  const billingReady =
    billingConfigured && present(env.MATRIXFLOW_BILLING_WEBHOOK_SECRET) && stripeReady;
  checks.push({
    name: 'billing',
    required: strict || billingConfigured,
    ok: billingReady,
    detail: billingReady
      ? `${env.MATRIXFLOW_BILLING_PROVIDER} adapter configured`
      : 'provider, checkout, or webhook secret missing',
  });

  const connectorHosts = String(env.MATRIXFLOW_CONNECTOR_ALLOWLIST || '')
    .split(',')
    .map((host) => host.trim())
    .filter(Boolean);
  checks.push({
    name: 'connector-egress',
    required: strict || connectorHosts.length > 0,
    ok: connectorHosts.length > 0,
    detail: connectorHosts.length
      ? `${connectorHosts.length} allowlisted host(s)`
      : 'no connector egress allowlist',
  });

  checks.push({
    name: 'alerting',
    required: strict,
    ok: httpsUrl(env.MATRIXFLOW_ALERT_WEBHOOK_URL),
    detail: httpsUrl(env.MATRIXFLOW_ALERT_WEBHOOK_URL)
      ? 'HTTPS alert destination configured'
      : 'HTTPS alert destination missing or invalid',
  });
  const backupFresh = recentTimestamp(env.MATRIXFLOW_BACKUP_LAST_SUCCESS_AT, 26 * 60 * 60 * 1000);
  checks.push({
    name: 'backup-evidence',
    required: strict,
    ok: httpsUrl(env.MATRIXFLOW_BACKUP_EVIDENCE_URL) && backupFresh,
    detail:
      httpsUrl(env.MATRIXFLOW_BACKUP_EVIDENCE_URL) && backupFresh
        ? 'HTTPS backup evidence is fresh within 26 hours'
        : 'HTTPS backup evidence or a fresh MATRIXFLOW_BACKUP_LAST_SUCCESS_AT is missing',
  });
  const restoreFresh = recentTimestamp(
    env.MATRIXFLOW_RESTORE_LAST_SUCCESS_AT,
    92 * 24 * 60 * 60 * 1000,
  );
  checks.push({
    name: 'restore-evidence',
    required: strict,
    ok: httpsUrl(env.MATRIXFLOW_RESTORE_EVIDENCE_URL) && restoreFresh,
    detail:
      httpsUrl(env.MATRIXFLOW_RESTORE_EVIDENCE_URL) && restoreFresh
        ? 'HTTPS restore evidence is fresh within 92 days'
        : 'HTTPS restore evidence or a recent MATRIXFLOW_RESTORE_LAST_SUCCESS_AT is missing',
  });
  checks.push({
    name: 'deployment-key',
    required: strict,
    ok: present(env.MATRIXFLOW_DEPLOY_KEY),
    detail: present(env.MATRIXFLOW_DEPLOY_KEY)
      ? 'short-lived deployment key supplied'
      : 'deployment key missing',
  });
  checks.push({
    name: 'production-safety',
    required: strict,
    ok:
      !production ||
      (!boolean(env.MATRIXFLOW_ALLOW_INSECURE_PROVIDER) &&
        !boolean(env.MATRIXFLOW_ALLOW_PRIVATE_PROVIDER)),
    detail: production
      ? 'private/insecure provider overrides disabled'
      : 'non-production environment',
  });
  const failedRequired = checks.filter((check) => check.required && !check.ok);
  return { strict, production, providerNames, checks, ready: failedRequired.length === 0 };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const strict = process.argv.includes('--strict');
  const result = auditConfig(process.env, { strict });
  for (const check of result.checks) {
    const status = check.ok ? 'PASS' : check.required ? 'FAIL' : 'WARN';
    process.stdout.write(`${status} ${check.name}: ${check.detail}\n`);
  }
  if (!result.ready) process.exitCode = 1;
}
