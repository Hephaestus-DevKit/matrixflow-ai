import { ServiceUnavailableException } from '@nestjs/common';
import { HealthController } from '../src/health/health.controller';

function createController({
  database = true,
  redis = true,
  objectStorage = true,
  objectStorageRequired,
}: {
  database?: boolean;
  redis?: boolean;
  objectStorage?: boolean;
  objectStorageRequired?: string;
} = {}) {
  const resolveOrReject = (available: boolean, value: unknown) =>
    available ? Promise.resolve(value) : Promise.reject(new Error('unavailable'));

  return new HealthController(
    {
      $queryRaw: () => resolveOrReject(database, [{ '?column?': 1 }]),
    } as never,
    {
      ping: () => resolveOrReject(redis, 'PONG'),
    } as never,
    {
      health: () => resolveOrReject(objectStorage, true),
    } as never,
    {
      get: () => objectStorageRequired,
    } as never,
  );
}

describe('HealthController readiness', () => {
  it('reports all required components as ready', async () => {
    await expect(createController().readiness()).resolves.toEqual({
      status: 'ready',
      components: { database: 'up', redis: 'up', objectStorage: 'up' },
    });
  });

  it('reports optional object storage as degraded without failing readiness', async () => {
    await expect(
      createController({ objectStorage: false, objectStorageRequired: 'false' }).readiness(),
    ).resolves.toEqual({
      status: 'degraded',
      components: { database: 'up', redis: 'up', objectStorage: 'down' },
    });
  });

  it('fails readiness when a critical component is unavailable', async () => {
    await expect(createController({ redis: false }).readiness()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    await expect(createController({ objectStorage: false }).readiness()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
