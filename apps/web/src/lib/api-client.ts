// API Client — 统一封装 fetch + Appwrite auth + error
import { account } from './appwrite';

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3002/api/v1';

let cachedJwt = '';
let tokenExpiresAt = 0;

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
    tokenExpiresAt = Date.now() + 15 * 60 * 1000; // Cache for 15 minutes
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

export async function api<T = unknown>(path: string, opts: RequestInit = {}): Promise<T> {
  const at = await getAppwriteToken();
  const orgId = typeof window !== 'undefined' ? localStorage.getItem('mfa_oid') ?? undefined : undefined;
  
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(at ? { Authorization: `Bearer ${at}` } : {}),
      ...(orgId ? { 'x-organization-id': orgId } : {}),
      ...opts.headers,
    },
  });

  if (res.status === 401) {
    if (typeof window !== 'undefined') {
      clearAppwriteCache();
      await account.deleteSession('current').catch(() => {});
      window.location.href = '/login';
    }
    throw new Error('Unauthorized');
  }

  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw Object.assign(new Error(e.error?.message ?? res.statusText), { code: e.error?.code, status: res.status });
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

export const apiClient = {
  get: <T = unknown>(path: string) => api<T>(path),
  post: <T = unknown>(path: string, body: unknown) => api<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  put: <T = unknown>(path: string, body: unknown) => api<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  patch: <T = unknown>(path: string, body: unknown) => api<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  del: <T = unknown>(path: string) => api<T>(path, { method: 'DELETE' }),
};
