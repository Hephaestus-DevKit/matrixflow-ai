import { apiClient, ApiError } from '../src/lib/api-client';
import { routeBackend, routeUpload } from '../src/lib/backend/router';

jest.mock('../src/lib/backend/router', () => ({
  routeBackend: jest.fn(),
  routeUpload: jest.fn(),
}));
jest.mock('../src/lib/backend/data', () => ({ BackendError: class extends Error {} }));

beforeEach(() => jest.clearAllMocks());

test('an already canceled write never reaches the backend', async () => {
  const controller = new AbortController();
  controller.abort();
  await expect(
    apiClient.post('/agents', { name: 'Support' }, { signal: controller.signal }),
  ).rejects.toMatchObject({ code: 'REQUEST_ABORTED' });
  expect(routeBackend).not.toHaveBeenCalled();
});

test('an already canceled upload never reaches Storage', async () => {
  const controller = new AbortController();
  controller.abort();
  await expect(
    apiClient.upload('/kb/base/documents', new FormData(), { signal: controller.signal }),
  ).rejects.toBeInstanceOf(ApiError);
  expect(routeUpload).not.toHaveBeenCalled();
});

test('a request preserves the caller idempotency key for a retry', async () => {
  jest.mocked(routeBackend).mockResolvedValue({ id: 'agent-1' });
  await expect(
    apiClient.post('/agents', { name: 'Support' }, { idempotencyKey: 'retry-key-1' }),
  ).resolves.toEqual({ id: 'agent-1' });
  expect(routeBackend).toHaveBeenCalledWith(
    'POST',
    '/agents',
    { name: 'Support' },
    {
      idempotencyKey: 'retry-key-1',
    },
  );
});
