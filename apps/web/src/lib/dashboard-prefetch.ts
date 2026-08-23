import type { QueryClient, QueryKey } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

type PrefetchTarget = {
  queryKey: QueryKey;
  path: string;
};

const ROUTE_DATA: Record<string, PrefetchTarget[]> = {
  '/dashboard': [
    { queryKey: ['agents'], path: '/agents' },
    { queryKey: ['content-projects'], path: '/content/projects' },
    { queryKey: ['kb'], path: '/kb' },
    { queryKey: ['usage'], path: '/billing/usage' },
    { queryKey: ['system-health'], path: '/health' },
  ],
  '/dashboard/agents': [{ queryKey: ['agents', 0], path: '/agents?limit=24&offset=0' }],
  '/dashboard/content': [
    {
      queryKey: ['content-projects', 0],
      path: '/content/projects?limit=12&offset=0',
    },
  ],
  '/dashboard/knowledge': [{ queryKey: ['kb', 0], path: '/kb?limit=24&offset=0' }],
  '/dashboard/workflows': [{ queryKey: ['wfs', 0], path: '/workflows?limit=24&offset=0' }],
  '/dashboard/jobs': [{ queryKey: ['jobs', 0], path: '/jobs?limit=25&offset=0' }],
  '/dashboard/crm': [
    { queryKey: ['customers', 0], path: '/crm/customers?limit=50&offset=0' },
    { queryKey: ['leads', 0], path: '/crm/leads?limit=50&offset=0' },
  ],
  '/dashboard/marketplace': [{ queryKey: ['market'], path: '/market/items?pageSize=24' }],
  '/dashboard/analytics': [{ queryKey: ['usage'], path: '/billing/usage' }],
  '/dashboard/billing': [
    { queryKey: ['plans'], path: '/billing/plans' },
    { queryKey: ['sub'], path: '/billing/current' },
    { queryKey: ['usage'], path: '/billing/usage' },
    { queryKey: ['billing-requests'], path: '/billing/requests' },
    { queryKey: ['billing-config'], path: '/billing/config' },
  ],
  '/dashboard/admin': [{ queryKey: ['admin-health'], path: '/admin/health' }],
};

/**
 * Start the first data requests as soon as a user expresses navigation intent.
 * React Query deduplicates these requests with the destination page and keeps
 * already-fresh cache entries from generating extra traffic.
 */
export async function prefetchDashboardData(queryClient: QueryClient, href: string) {
  if (typeof navigator !== 'undefined') {
    const connection = (
      navigator as Navigator & {
        connection?: { saveData?: boolean; effectiveType?: string };
      }
    ).connection;
    if (
      connection?.saveData ||
      connection?.effectiveType === 'slow-2g' ||
      connection?.effectiveType === '2g'
    )
      return;
  }
  const targets = ROUTE_DATA[href] ?? [];
  await Promise.allSettled(
    targets.map(({ queryKey, path }) =>
      queryClient.prefetchQuery({
        queryKey,
        queryFn: () => apiClient.get(path),
        staleTime: 60_000,
      }),
    ),
  );
}
