'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { LocaleSwitcher } from '@/components/locale-switcher';
import { useLocale } from '@/lib/i18n';

export function PublicHeader() {
  const { t } = useLocale();

  return (
    <header className="public-header sticky top-0 z-50 border-b border-border/[0.55] bg-background/75 backdrop-blur-2xl">
      <div className="mx-auto flex h-[3.75rem] max-w-6xl items-center justify-between gap-2 px-3 sm:px-6">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2.5 whitespace-nowrap rounded-xl py-1 font-semibold tracking-[-0.02em] outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <span className="brand-mark h-8 w-8 rounded-[0.65rem]" aria-hidden="true">
            M
          </span>
          <span className="sr-only">MatrixFlow AI</span>
          <span aria-hidden="true" className="hidden min-[500px]:inline">
            MatrixFlow AI
          </span>
        </Link>
        <nav
          aria-label={t('public.navLabel')}
          className="flex min-w-0 items-center gap-0.5 sm:gap-2"
        >
          <LocaleSwitcher compact />
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="hidden rounded-full min-[360px]:inline-flex"
          >
            <Link href="/pricing">{t('public.pricing')}</Link>
          </Button>
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="rounded-full px-2.5 text-xs min-[420px]:px-3.5 sm:text-sm"
          >
            <Link href="/login">{t('public.login')}</Link>
          </Button>
          <Button
            asChild
            size="sm"
            className="rounded-full px-2.5 text-xs min-[420px]:px-3.5 sm:text-sm"
          >
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
    <footer className="border-t border-border/[0.55] bg-white/35 px-4 py-8 text-xs text-muted-foreground backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
        <span>{t('public.footer')}</span>
        <nav
          aria-label={t('public.legalNav')}
          className="flex flex-wrap justify-center gap-x-4 gap-y-2"
        >
          <Link
            href="/pricing"
            className="inline-flex min-h-8 items-center rounded-lg px-1 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          >
            {t('public.pricing')}
          </Link>
          <Link
            href="/terms"
            className="inline-flex min-h-8 items-center rounded-lg px-1 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          >
            {t('public.terms')}
          </Link>
          <Link
            href="/privacy"
            className="inline-flex min-h-8 items-center rounded-lg px-1 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          >
            {t('public.privacy')}
          </Link>
          <a
            href="https://github.com/Hephaestus-DevKit/matrixflow-ai/security"
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-8 items-center rounded-lg px-1 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          >
            {t('public.security')}
          </a>
        </nav>
      </div>
    </footer>
  );
}
