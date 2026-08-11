import { BackendError } from '@/lib/backend/data';
import { clearOrganizationContext } from '@/lib/backend/organization-context';
import { routeBackend, routeUpload } from '@/lib/backend/router';

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function normalizeError(error: unknown): never {
  if (error instanceof ApiError) throw error;
  if (error instanceof BackendError) throw new ApiError(error.message, error.status, error.code);
  const candidate = error as { message?: unknown; code?: unknown; type?: unknown };
  const message = typeof candidate?.message === 'string' ? candidate.message : 'Appwrite 请求失败';
  const status = typeof candidate?.code === 'number' ? candidate.code : 500;
  const code = typeof candidate?.type === 'string' ? candidate.type : 'APPWRITE_ERROR';
  throw new ApiError(message, status, code);
}

async function call<T>(
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown,
) {
  try {
    return (await routeBackend(method, path, body)) as T;
  } catch (error) {
    normalizeError(error);
  }
}

export function clearAppwriteCache() {
  // The Appwrite Web SDK owns session refresh and invalidation.
}

export { clearOrganizationContext };

export const apiClient = {
  get: <T = unknown>(path: string) => call<T>('GET', path),
  post: <T = unknown>(path: string, body: unknown) => call<T>('POST', path, body),
  put: <T = unknown>(path: string, body: unknown) => call<T>('PUT', path, body),
  patch: <T = unknown>(path: string, body: unknown) => call<T>('PATCH', path, body),
  del: <T = unknown>(path: string) => call<T>('DELETE', path),
  upload: async <T = unknown>(path: string, body: FormData) => {
    try {
      return (await routeUpload(path, body)) as T;
    } catch (error) {
      normalizeError(error);
    }
  },
};
