'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, Home, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLocale } from '@/lib/i18n';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useLocale();
  useEffect(() => {
    // Keep detailed diagnostics in the browser while the UI exposes a safe message.
    console.error(error);
  }, [error]);

  return (
    <main id="main-content" className="flex min-h-screen items-center justify-center px-5">
      <section className="surface-card w-full max-w-lg p-8 text-center sm:p-10">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
          <AlertTriangle className="h-7 w-7" />
        </span>
        <p className="mt-5 text-xs font-bold uppercase tracking-[0.18em] text-destructive">
          {t('common.unexpectedLabel')}
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">{t('common.unexpectedError')}</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {t('common.unexpectedErrorDescription')}
        </p>
        {error.digest && (
          <p className="mt-3 font-mono text-[0.6875rem] text-muted-foreground">
            {t('common.errorCode')}：{error.digest}
          </p>
        )}
        <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
          <Button onClick={reset} className="gap-2">
            <RotateCcw className="h-4 w-4" /> {t('common.reload')}
          </Button>
          <Button variant="outline" asChild className="gap-2">
            <Link href="/">
              <Home className="h-4 w-4" /> {t('common.backHome')}
            </Link>
          </Button>
        </div>
      </section>
    </main>
  );
}
