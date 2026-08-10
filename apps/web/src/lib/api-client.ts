// API Client — 统一封装 fetch + Appwrite auth + error
import { account } from './appwrite';

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001/api/v1';

let cachedJwt = '';
let tokenExpiresAt = 0;
let pendingJwt: Promise<string | null> | null = null;
let tokenGeneration = 0;

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

function decodeExpiry(token: string): number {
  try {
    const segment = token.split('.')[1];
    if (!segment) return 0;
    const normalized = segment.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    const payload = JSON.parse(atob(padded)) as {
      exp?: number;
    };
    return typeof payload.exp === 'number' ? payload.exp * 1_000 : 0;
  } catch {
    return 0;
  }
}

function persistedOrganizationId(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    const persisted = JSON.parse(localStorage.getItem('mfa-auth') ?? '{}') as {
      state?: { organizationId?: unknown };
    };
    return typeof persisted.state?.organizationId === 'string'
      ? persisted.state.organizationId
      : undefined;
  } catch {
    return undefined;
  }
}

export async function getAppwriteToken(): Promise<string | null> {
  const now = Date.now();
  if (cachedJwt && tokenExpiresAt > now + 3 * 60 * 1000) return cachedJwt;
  if (pendingJwt) return pendingJwt;

  const generation = tokenGeneration;
  const refresh = (async () => {
    try {
      const session = await account.getSession('current').catch(() => null);
      if (!session) {
        if (generation === tokenGeneration) {
          cachedJwt = '';
          tokenExpiresAt = 0;
        }
        return null;
      }

      const res = await account.createJWT();
      if (generation !== tokenGeneration) return null;
      cachedJwt = res.jwt;
      tokenExpiresAt = decodeExpiry(res.jwt) || Date.now() + 10 * 60 * 1000;
      return cachedJwt;
    } catch {
      if (generation === tokenGeneration) {
        cachedJwt = '';
        tokenExpiresAt = 0;
      }
      return null;
    } finally {
      // A cache reset advances the generation before allowing another refresh.
      // The older request must not clear that newer request when it settles.
      if (generation === tokenGeneration) pendingJwt = null;
    }
  })();
  pendingJwt = refresh;
  return refresh;
}

export function clearAppwriteCache() {
  cachedJwt = '';
  tokenExpiresAt = 0;
  pendingJwt = null;
  tokenGeneration += 1;
}

export function clearOrganizationContext() {
  if (typeof window !== 'undefined') localStorage.removeItem('mfa-auth');
}

export async function api<T = unknown>(path: string, opts: RequestInit = {}): Promise<T> {
  let res = await performRequest(path, opts, await getAppwriteToken());

  if (res.status === 401) {
    clearAppwriteCache();
    res = await performRequest(path, opts, await getAppwriteToken());
  }

  if (!res.ok) {
    const payload = (await res
      .clone()
      .json()
      .catch(() => ({}))) as {
      error?: { message?: string; code?: string };
    };
    const fallbackMessage = (await res.text().catch(() => '')).trim();
    throw new ApiError(
      payload.error?.message || fallbackMessage || `请求失败（HTTP ${res.status}）`,
      res.status,
      payload.error?.code,
      res.headers.get('x-request-id') ?? undefined,
    );
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

async function performRequest(
  path: string,
  opts: RequestInit,
  token: string | null,
): Promise<Response> {
  try {
    return await request(path, opts, token);
  } catch (error) {
    if (opts.signal?.aborted) throw error;
    const timedOut =
      (typeof DOMException !== 'undefined' &&
        error instanceof DOMException &&
        error.name === 'TimeoutError') ||
      (error instanceof Error && /timeout|timed out/i.test(error.message));
    throw new ApiError(
      timedOut ? 'MatrixFlow API 响应超时，请稍后重试' : '无法连接 MatrixFlow API，请检查服务状态',
      0,
      timedOut ? 'REQUEST_TIMEOUT' : 'NETWORK_ERROR',
    );
  }
}

async function request(path: string, opts: RequestInit, token: string | null): Promise<Response> {
  const headers = new Headers(opts.headers);
  if (opts.body && !(opts.body instanceof FormData) && !headers.has('Content-Type'))
    headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const organizationId = persistedOrganizationId();
  if (organizationId) headers.set('x-organization-id', organizationId);
  const timeout = AbortSignal.timeout(Number(process.env.NEXT_PUBLIC_API_TIMEOUT_MS ?? 30_000));
  const signal = opts.signal ? AbortSignal.any([opts.signal, timeout]) : timeout;
  return fetch(`${BASE}${path}`, { ...opts, headers, signal });
}

export const apiClient = {
  get: <T = unknown>(path: string) => api<T>(path),
  post: <T = unknown>(path: string, body: unknown) =>
    api<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  put: <T = unknown>(path: string, body: unknown) =>
    api<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  patch: <T = unknown>(path: string, body: unknown) =>
    api<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  del: <T = unknown>(path: string) => api<T>(path, { method: 'DELETE' }),
  upload: <T = unknown>(path: string, body: FormData) => api<T>(path, { method: 'POST', body }),
};
