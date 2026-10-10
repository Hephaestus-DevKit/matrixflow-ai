import type { Route } from 'next';

/** Only resume a local protected route; reject cross-origin and protocol-relative URLs. */
export function dashboardDestination(value: string | null): Route {
  if (!value || !value.startsWith('/dashboard') || value.startsWith('//') || value.includes('\\'))
    return '/dashboard';
  try {
    const url = new URL(value, 'https://matrixflow.local');
    if (
      url.origin !== 'https://matrixflow.local' ||
      !(url.pathname === '/dashboard' || url.pathname.startsWith('/dashboard/'))
    )
      return '/dashboard';
    return `${url.pathname}${url.search}${url.hash}` as Route;
  } catch {
    return '/dashboard';
  }
}
