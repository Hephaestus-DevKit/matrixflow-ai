'use client';

import Link from 'next/link';
import { ArrowLeft, Compass } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLocale } from '@/lib/i18n';

export default function NotFound() {
  const { t } = useLocale();
  return (
    <main id="main-content" className="flex min-h-screen items-center justify-center px-5">
      <section className="surface-card w-full max-w-lg p-8 text-center sm:p-10">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Compass className="h-7 w-7" />
        </span>
        <p className="mt-5 text-xs font-bold uppercase tracking-[0.18em] text-primary">
          {t('common.notFoundLabel')}
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">{t('common.pageNotFound')}</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {t('common.pageNotFoundDescription')}
        </p>
        <Button asChild className="mt-6 gap-2">
          <Link href="/">
            <ArrowLeft className="h-4 w-4" /> {t('common.backHome')}
          </Link>
        </Button>
      </section>
    </main>
  );
}
