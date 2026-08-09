import {
  createCorsOptions,
  createHelmetOptions,
  validateEnvironment,
} from '../src/config/runtime-security';

const productionEnvironment: NodeJS.ProcessEnv = {
  NODE_ENV: 'production',
  AUTH_MODE: 'appwrite',
  DATABASE_URL: 'postgresql://database',
  REDIS_URL: 'redis://redis',
  CORS_ALLOWED_ORIGINS: 'https://app.example.com',
  MINIO_ENDPOINT: 'https://objects.example.com',
  MINIO_ACCESS_KEY: 'access',
  MINIO_SECRET_KEY: 'secret',
  INTERNAL_JOB_SECRET: 'i'.repeat(32),
  METRICS_TOKEN: 'm'.repeat(32),
  APPWRITE_PROJECT_ID: 'project',
  APPWRITE_ENDPOINT: 'https://cloud.appwrite.io/v1',
  GLM_API_KEY: 'provider-key',
};

describe('runtime security configuration', () => {
  it('keeps CSP enabled in every environment', () => {
    expect(createHelmetOptions({ NODE_ENV: 'development' }).contentSecurityPolicy).not.toBe(false);
    expect(createHelmetOptions({ NODE_ENV: 'production' }).contentSecurityPolicy).not.toBe(false);
  });

  it('allows configured origins and fails closed by default in production', () => {
    expect(createCorsOptions(productionEnvironment).origin).toEqual(['https://app.example.com']);
    expect(createCorsOptions({ NODE_ENV: 'production' }).origin).toBe(false);
    expect(createCorsOptions({ NODE_ENV: 'development' }).origin).toBe(true);
  });

  it('accepts a complete production environment', () => {
    expect(() => validateEnvironment(productionEnvironment)).not.toThrow();
  });

  it('rejects unsafe production origins and weak secrets', () => {
    expect(() =>
      validateEnvironment({ ...productionEnvironment, CORS_ALLOWED_ORIGINS: '*' }),
    ).toThrow('Wildcard CORS');
    expect(() => validateEnvironment({ ...productionEnvironment, METRICS_TOKEN: 'short' })).toThrow(
      'METRICS_TOKEN',
    );
  });

  it('rejects invalid numeric runtime settings', () => {
    expect(() => validateEnvironment({ NODE_ENV: 'test', TRUST_PROXY_HOPS: '-1' })).toThrow(
      'TRUST_PROXY_HOPS',
    );
    expect(() => validateEnvironment({ NODE_ENV: 'test', PORT: 'invalid' })).toThrow('PORT');
  });
});
