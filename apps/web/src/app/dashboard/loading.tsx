'use client';

import { useLocale } from '@/lib/i18n';

export default function DashboardRouteLoading() {
  const { t } = useLocale();
  return (
    <div
      role="status"
      aria-label={t('common.loadingContent')}
      className="space-y-6"
      aria-live="polite"
    >
      <div className="space-y-2">
        <div className="h-3 w-24 animate-pulse rounded-full bg-muted" />
        <div className="h-7 w-52 animate-pulse rounded-lg bg-muted" />
        <div className="h-3 w-full max-w-lg animate-pulse rounded-full bg-muted/70" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <div key={index} className="surface-card animate-pulse p-5">
            <div className="h-10 w-10 rounded-xl bg-muted" />
            <div className="mt-5 h-4 w-2/5 rounded bg-muted" />
            <div className="mt-2 h-3 w-3/5 rounded bg-muted/75" />
            <div className="mt-6 h-px bg-border" />
            <div className="mt-3 h-3 w-1/4 rounded bg-muted/[0.65]" />
          </div>
        ))}
      </div>
      <span className="sr-only">{t('common.loadingContent')}</span>
    </div>
  );
}
