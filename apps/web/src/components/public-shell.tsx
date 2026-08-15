'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { LocaleSwitcher } from '@/components/locale-switcher';
import { useLocale } from '@/lib/i18n';

export function PublicHeader() {
  const { t } = useLocale();

  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-3 sm:px-6">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2.5 whitespace-nowrap rounded-lg py-1 font-bold tracking-tight outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <span className="brand-mark h-8 w-8 rounded-lg" aria-hidden="true">
            M
          </span>
          MatrixFlow AI
        </Link>
        <nav aria-label={t('public.navLabel')} className="flex items-center gap-0.5 sm:gap-2">
          <LocaleSwitcher compact />
          <Button asChild variant="ghost" size="sm" className="hidden h-10 md:inline-flex">
            <Link href="/pricing">{t('public.pricing')}</Link>
          </Button>
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="h-10 px-2 text-xs sm:px-3 sm:text-sm"
          >
            <Link href="/login">{t('public.login')}</Link>
          </Button>
          <Button asChild size="sm" className="h-10 px-2 text-xs sm:px-3 sm:text-sm">
            <Link href="/register">{t('public.register')}</Link>
          </Button>
        </nav>
      </div>
    </header>
  );
}

export function PublicFooter() {
  const { t } = useLocale();

  return (
    <footer className="border-t border-border/60 px-4 py-8 text-xs text-muted-foreground">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
        <span>{t('public.footer')}</span>
        <nav
          aria-label={t('public.legalNav')}
          className="flex flex-wrap justify-center gap-x-4 gap-y-2"
        >
          <Link
            href="/pricing"
            className="rounded-sm outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          >
            {t('public.pricing')}
          </Link>
          <Link
            href="/terms"
            className="rounded-sm outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          >
            {t('public.terms')}
          </Link>
          <Link
            href="/privacy"
            className="rounded-sm outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          >
            {t('public.privacy')}
          </Link>
          <a
            href="https://github.com/Hephaestus-DevKit/matrixflow-ai/security"
            target="_blank"
            rel="noreferrer"
            className="rounded-sm outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          >
            {t('public.security')}
          </a>
        </nav>
      </div>
    </footer>
  );
}
