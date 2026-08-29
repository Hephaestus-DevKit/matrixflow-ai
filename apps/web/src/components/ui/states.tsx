'use client';

import { AlertTriangle, LoaderCircle, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { useLocale } from '@/lib/i18n';

export function Spinner({ className }: { className?: string }) {
  return (
    <LoaderCircle
      aria-hidden="true"
      className={cn('h-5 w-5 animate-spin text-primary', className)}
    />
  );
}

export function PageLoader({ label }: { label?: string }) {
  const { t } = useLocale();
  return (
    <div
      role="status"
      className="flex min-h-52 flex-col items-center justify-center gap-3 text-center sm:min-h-64"
    >
      <span className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
        <Spinner className="h-6 w-6" />
      </span>
      <p className="text-sm font-medium text-muted-foreground">{label || t('common.loading')}</p>
    </div>
  );
}

export function LoadingCards({ count = 3 }: { count?: number }) {
  const { t } = useLocale();
  return (
    <div
      role="status"
      aria-label={t('common.loadingContent')}
      className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
    >
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="surface-card overflow-hidden p-5">
          <div className="animate-pulse">
            <div className="h-10 w-10 rounded-xl bg-muted" />
            <div className="mt-5 h-4 w-2/5 rounded bg-muted" />
            <div className="mt-2 h-3 w-3/5 rounded bg-muted/80" />
            <div className="mt-6 h-px bg-border" />
            <div className="mt-3 h-3 w-1/4 rounded bg-muted/70" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <section className="flex min-h-60 flex-col items-center justify-center rounded-2xl border border-dashed border-border/80 bg-card/[0.55] px-5 py-12 text-center backdrop-blur-sm sm:min-h-72 sm:px-6 sm:py-14">
      {Icon && (
        <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Icon className="h-6 w-6" aria-hidden="true" />
        </span>
      )}
      <h2 className="text-base font-bold text-foreground">{title}</h2>
      {description && (
        <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </section>
  );
}

export function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  const { t } = useLocale();
  return (
    <section
      role="alert"
      className="flex min-h-56 flex-col items-center justify-center rounded-2xl border border-destructive/20 bg-destructive/5 px-5 py-10 text-center backdrop-blur-sm sm:min-h-64 sm:px-6 sm:py-12"
    >
      <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
        <AlertTriangle className="h-6 w-6" aria-hidden="true" />
      </span>
      <h2 className="text-base font-bold text-foreground">{t('common.dataLoadFailed')}</h2>
      <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
        {message ?? t('common.dataLoadFailedDescription')}
      </p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry} className="mt-5">
          {t('common.retry')}
        </Button>
      )}
    </section>
  );
}
