'use client';

import { ReactNode, useEffect, useMemo } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-store';
import { LocaleProvider, type Locale } from '@/lib/i18n';

export function Providers({
  children,
  initialLocale,
}: {
  children: ReactNode;
  initialLocale: Locale;
}) {
  const organizationId = useAuth((state) => state.organizationId);
  const userId = useAuth((state) => state.user?.id);
  const qc = useMemo(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            meta: { organizationId, userId },
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
    [organizationId, userId],
  );
  useEffect(() => () => qc.clear(), [qc]);
  return (
    <QueryClientProvider client={qc}>
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
        <LocaleProvider initialLocale={initialLocale}>{children}</LocaleProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
