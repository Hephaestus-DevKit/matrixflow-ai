import { configuredProviders, providerCapabilities } from './provider.js';
import { billingProviderReadiness } from './billing-provider.js';

export function providerReadiness() {
  try {
    const providers = configuredProviders();
    const primary = providers[0];
    return {
      ready: true,
      provider: primary.name,
      gateway: primary.gateway,
      protocol: primary.protocol,
      model: primary.model,
      providers: providers.map((provider) => ({
        name: provider.name,
        gateway: provider.gateway,
        protocol: provider.protocol,
        model: provider.model,
      })),
      fallback: providers.length > 1,
      capabilities: providerCapabilities,
    };
  } catch (error) {
    return {
      ready: false,
      code: error.code || 'AI_PROVIDER_UNAVAILABLE',
      providers: [],
      capabilities: providerCapabilities,
    };
  }
}

export function readinessSnapshot() {
  const ai = providerReadiness();
  const providerRequired =
    String(process.env.MATRIXFLOW_REQUIRE_PROVIDER || '').toLowerCase() === 'true';
  const asyncRequired = String(process.env.MATRIXFLOW_REQUIRE_ASYNC || '').toLowerCase() === 'true';
  const billingRequired =
    String(process.env.MATRIXFLOW_REQUIRE_BILLING || '').toLowerCase() === 'true';
  const asyncConfigured = String(process.env.MATRIXFLOW_WORKER_SECRET || '').length >= 32;
  const billing = billingProviderReadiness();
  const checks = {
    function: { status: 'ok' },
    provider: {
      status: ai.ready ? 'ok' : providerRequired ? 'failed' : 'degraded',
      configured: ai.ready,
      required: providerRequired,
    },
    asyncWorker: {
      status: asyncConfigured ? 'ok' : asyncRequired ? 'failed' : 'degraded',
      configured: asyncConfigured,
      required: asyncRequired,
    },
    billing: {
      status: billing.ready && billing.webhook ? 'ok' : billingRequired ? 'failed' : 'degraded',
      configured: billing.ready && billing.webhook,
      required: billingRequired,
    },
  };
  const ready = Object.values(checks).every((check) => check.status !== 'failed');
  return { ready, status: ready ? (ai.ready ? 'ok' : 'degraded') : 'failed', checks, ai };
}
