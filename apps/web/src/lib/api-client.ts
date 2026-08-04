// API Client — 统一封装 fetch + Appwrite auth + error
import { account } from './appwrite';

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3002/api/v1';

let cachedJwt = '';
let tokenExpiresAt = 0;

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
  try {
    const now = Date.now();
    if (cachedJwt && tokenExpiresAt > now + 3 * 60 * 1000) {
      return cachedJwt;
    }

    const session = await account.getSession('current').catch(() => null);
    if (!session) {
      cachedJwt = '';
      tokenExpiresAt = 0;
      return null;
    }

    const res = await account.createJWT();
    cachedJwt = res.jwt;
    tokenExpiresAt = decodeExpiry(res.jwt) || Date.now() + 10 * 60 * 1000;
    return cachedJwt;
  } catch {
    cachedJwt = '';
    tokenExpiresAt = 0;
    return null;
  }
}

export function clearAppwriteCache() {
  cachedJwt = '';
  tokenExpiresAt = 0;
}

export function clearOrganizationContext() {
  if (typeof window !== 'undefined') localStorage.removeItem('mfa-auth');
}

export async function api<T = unknown>(path: string, opts: RequestInit = {}): Promise<T> {
  let res = await request(path, opts, await getAppwriteToken());

  if (res.status === 401) {
    clearAppwriteCache();
    res = await request(path, opts, await getAppwriteToken());
  }

  if (!res.ok) {
    const payload = (await res.json().catch(() => ({}))) as {
      error?: { message?: string; code?: string };
    };
    throw Object.assign(new Error(payload.error?.message ?? res.statusText), {
      code: payload.error?.code,
      status: res.status,
    });
  }

  if (res.status === 204) return undefined as T;
  return res.json();
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
