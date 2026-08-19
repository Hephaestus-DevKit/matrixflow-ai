import { BackendError } from '@/lib/backend/data';
import { clearOrganizationContext } from '@/lib/backend/organization-context';
import { routeBackend, routeUpload } from '@/lib/backend/router';

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
    public readonly requestId?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface RequestOptions {
  /** Reuse this value when retrying an operation after an unknown network outcome. */
  idempotencyKey?: string;
  /** Stop waiting for a backend call that cannot complete in the current interaction. */
  timeoutMs?: number;
  /** Cancel the UI wait when the owning view is unmounted or navigation starts. */
  signal?: AbortSignal;
}

export interface ListPage<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
  nextOffset: number | null;
}

export type ListResponse<T> = T[] | ListPage<T>;

export function listData<T>(response: ListResponse<T> | undefined): T[] {
  if (Array.isArray(response)) return response;
  return response?.data ?? [];
}

function normalizeError(error: unknown): never {
  if (error instanceof ApiError) throw error;
  if (error instanceof BackendError)
    throw new ApiError(error.message, error.status, error.code, error.requestId);
  const candidate = error as {
    message?: unknown;
    code?: unknown;
    type?: unknown;
    requestId?: unknown;
  };
  const status = typeof candidate?.code === 'number' ? candidate.code : 500;
  const code =
    status === 401
      ? 'UNAUTHENTICATED'
      : status === 403
        ? 'FORBIDDEN'
        : status === 404
          ? 'RESOURCE_NOT_FOUND'
          : status === 429
            ? 'RATE_LIMITED'
            : typeof candidate?.type === 'string'
              ? candidate.type
              : error instanceof TypeError
                ? 'NETWORK_ERROR'
                : 'APPWRITE_ERROR';
  throw new ApiError(
    '',
    status,
    code,
    typeof candidate?.requestId === 'string' ? candidate.requestId : undefined,
  );
}

function guardedRequest<T>(task: Promise<T>, options: RequestOptions, timeoutMs: number) {
  const timeout = Math.max(1_000, options.timeoutMs ?? timeoutMs);
  if (options.signal?.aborted)
    return Promise.reject(new ApiError('', 499, 'REQUEST_ABORTED')) as Promise<T>;

  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const timer = globalThis.setTimeout(() => {
      if (settled) return;
      settled = true;
      options.signal?.removeEventListener('abort', abort);
      reject(new ApiError('', 504, 'REQUEST_TIMEOUT'));
    }, timeout);
    const abort = () => {
      if (settled) return;
      settled = true;
      globalThis.clearTimeout(timer);
      reject(new ApiError('', 499, 'REQUEST_ABORTED'));
    };
    options.signal?.addEventListener('abort', abort, { once: true });
    task.then(
      (value) => {
        if (settled) return;
        settled = true;
        globalThis.clearTimeout(timer);
        options.signal?.removeEventListener('abort', abort);
        resolve(value);
      },
      (error) => {
        if (settled) return;
        settled = true;
        globalThis.clearTimeout(timer);
        options.signal?.removeEventListener('abort', abort);
        reject(error);
      },
    );
  });
}

async function call<T>(
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown,
  options: RequestOptions = {},
) {
  try {
    const idempotencyKey =
      method === 'GET'
        ? undefined
        : options.idempotencyKey ||
          `mf-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`}`;
    return (await guardedRequest(
      routeBackend(method, path, body, { idempotencyKey }),
      options,
      method === 'GET' ? 20_000 : 30_000,
    )) as T;
  } catch (error) {
    normalizeError(error);
  }
}

export function clearAppwriteCache() {
  // The Appwrite Web SDK owns session refresh and invalidation.
}

export { clearOrganizationContext };

export const apiClient = {
  get: <T = unknown>(path: string, options?: RequestOptions) =>
    call<T>('GET', path, undefined, options),
  post: <T = unknown>(path: string, body: unknown, options?: RequestOptions) =>
    call<T>('POST', path, body, options),
  put: <T = unknown>(path: string, body: unknown, options?: RequestOptions) =>
    call<T>('PUT', path, body, options),
  patch: <T = unknown>(path: string, body: unknown, options?: RequestOptions) =>
    call<T>('PATCH', path, body, options),
  del: <T = unknown>(path: string, body?: unknown, options?: RequestOptions) =>
    call<T>('DELETE', path, body, options),
  upload: async <T = unknown>(path: string, body: FormData, options: RequestOptions = {}) => {
    try {
      const idempotencyKey =
        options.idempotencyKey ||
        `mf-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`}`;
      return (await guardedRequest(
        routeUpload(path, body, { idempotencyKey }),
        options,
        60_000,
      )) as T;
    } catch (error) {
      normalizeError(error);
    }
  },
};
