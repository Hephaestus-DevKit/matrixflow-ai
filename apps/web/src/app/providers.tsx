'use client';

import { ReactNode, useEffect, useRef } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { ThemeProvider } from 'next-themes';
import { ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-store';
import { LocaleProvider, type Locale } from '@/lib/i18n';

function OrganizationCacheBoundary({ queryClient }: { queryClient: QueryClient }) {
  const organizationId = useAuth((state) => state.organizationId);
  const previousOrganizationId = useRef(organizationId);

  useEffect(() => {
    if (previousOrganizationId.current !== organizationId) queryClient.clear();
    previousOrganizationId.current = organizationId;
  }, [organizationId, queryClient]);
  return null;
}

export function Providers({
  children,
  initialLocale,
}: {
  children: ReactNode;
  initialLocale: Locale;
}) {
  const [qc] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: (failureCount, error) => {
              if (failureCount >= 2) return false;
              if (!(error instanceof ApiError)) return true;
              if (error.status === 0) return true;
              return error.status === 408 || error.status === 429 || error.status >= 500;
            },
            refetchOnWindowFocus: false,
          },
          mutations: { retry: false },
        },
      }),
  );
  return (
    <QueryClientProvider client={qc}>
      <OrganizationCacheBoundary queryClient={qc} />
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
        <LocaleProvider initialLocale={initialLocale}>{children}</LocaleProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
