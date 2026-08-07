import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';
import type { HelmetOptions } from 'helmet';

const PRODUCTION_REQUIRED_KEYS = [
  'DATABASE_URL',
  'REDIS_URL',
  'CORS_ALLOWED_ORIGINS',
  'MINIO_ENDPOINT',
  'MINIO_ACCESS_KEY',
  'MINIO_SECRET_KEY',
  'INTERNAL_JOB_SECRET',
  'METRICS_TOKEN',
] as const;

export function createCorsOptions(env: NodeJS.ProcessEnv): CorsOptions {
  const configured = env.CORS_ALLOWED_ORIGINS ?? env.CORS_ORIGINS;
  const origins = configured
    ?.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  return {
    origin: origins?.length ? origins : env.NODE_ENV === 'production' ? false : true,
    credentials: true,
  };
}

export function createHelmetOptions(env: NodeJS.ProcessEnv): HelmetOptions {
  const production = env.NODE_ENV === 'production';
  return {
    frameguard: { action: 'deny' },
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'none'"],
        baseUri: ["'none'"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'", 'data:'],
        formAction: ["'none'"],
        frameAncestors: ["'none'"],
        imgSrc: ["'self'", 'data:'],
        objectSrc: ["'none'"],
        scriptSrc: production ? ["'none'"] : ["'self'", "'unsafe-inline'"],
        styleSrc: production ? ["'none'"] : ["'self'", "'unsafe-inline'"],
      },
    },
  };
}

export function validateEnvironment(env: NodeJS.ProcessEnv): void {
  validateNumericSetting(env.PORT, 'PORT', { min: 1, max: 65_535 });
  validateNumericSetting(env.TRUST_PROXY_HOPS, 'TRUST_PROXY_HOPS', { min: 0, max: 32 });
  if (env.NODE_ENV !== 'production') return;

  const authMode = env.AUTH_MODE ?? 'appwrite';
  const required: string[] = [...PRODUCTION_REQUIRED_KEYS];
  if (authMode === 'appwrite') required.push('APPWRITE_PROJECT_ID', 'APPWRITE_ENDPOINT');
  if (authMode === 'local') required.push('JWT_SECRET');
  if (!['appwrite', 'local'].includes(authMode)) {
    throw new Error('AUTH_MODE must be appwrite or local');
  }

  const missing = required.filter((key) => !env[key]?.trim());
  if (missing.length) {
    throw new Error(`Missing required production configuration: ${missing.join(', ')}`);
  }
  if (!env.GLM_API_KEY?.trim() && !env.OPENAI_API_KEY?.trim()) {
    throw new Error('At least one AI provider API key is required');
  }

  const origins = env.CORS_ALLOWED_ORIGINS?.split(',').map((origin) => origin.trim()) ?? [];
  if (origins.includes('*')) throw new Error('Wildcard CORS is not allowed with credentials');
  for (const origin of origins) {
    const parsed = new URL(origin);
    if (parsed.origin !== origin || !['https:', 'http:'].includes(parsed.protocol)) {
      throw new Error(`Invalid CORS origin: ${origin}`);
    }
  }

  if (authMode === 'appwrite' && !env.APPWRITE_ENDPOINT?.startsWith('https://')) {
    throw new Error('APPWRITE_ENDPOINT must use HTTPS in production');
  }
  assertSecretLength(env.INTERNAL_JOB_SECRET, 'INTERNAL_JOB_SECRET');
  assertSecretLength(env.METRICS_TOKEN, 'METRICS_TOKEN');
  if (authMode === 'local') assertSecretLength(env.JWT_SECRET, 'JWT_SECRET');
}

function assertSecretLength(value: string | undefined, key: string): void {
  if ((value?.length ?? 0) < 32) throw new Error(`${key} must contain at least 32 characters`);
}

function validateNumericSetting(
  value: string | undefined,
  key: string,
  range: { min: number; max: number },
): void {
  if (value === undefined) return;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < range.min || parsed > range.max) {
    throw new Error(`${key} must be an integer between ${range.min} and ${range.max}`);
  }
}
