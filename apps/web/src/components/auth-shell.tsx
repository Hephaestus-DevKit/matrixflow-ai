'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, ShieldCheck, Sparkles } from 'lucide-react';
import { cn } from '@/lib/cn';
import { LocaleSwitcher } from '@/components/locale-switcher';
import { useLocale } from '@/lib/i18n';

const highlights = [
  'auth.highlight.identity',
  'auth.highlight.isolation',
  'auth.highlight.session',
] as const;

interface AuthShellProps {
  title: string;
  description: string;
  children: ReactNode;
  footer: ReactNode;
  step?: string;
}

export function AuthShell({ title, description, children, footer, step }: AuthShellProps) {
  const { t } = useLocale();

  return (
    <main
      id="main-content"
      className="auth-page relative grid min-h-screen overflow-hidden lg:grid-cols-[minmax(0,1.05fr)_minmax(430px,0.95fr)]"
    >
      <div className="auth-ambient pointer-events-none absolute inset-0" />

      <section className="auth-side relative hidden min-h-screen overflow-hidden border-r border-slate-200/80 p-12 lg:flex lg:flex-col lg:justify-between xl:p-16">
        <div className="auth-side-grid absolute inset-0" />
        <Link
          href="/"
          className="relative flex w-fit items-center gap-3 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <span className="brand-mark h-11 w-11 rounded-[0.9rem] text-base">M</span>
          <span>
            <span className="font-display block text-sm font-semibold tracking-[-0.015em]">
              MatrixFlow AI
            </span>
            <span className="block text-2xs font-medium uppercase tracking-[0.16em] text-slate-500">
              AI workforce OS
            </span>
          </span>
        </Link>

        <div className="relative max-w-xl space-y-9">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-white/70 px-3 py-1.5 text-xs font-semibold text-primary shadow-[0_8px_24px_-20px_rgb(79_70_229/0.65)] backdrop-blur-sm">
            <Sparkles className="h-3.5 w-3.5" /> {t('auth.badge')}
          </div>
          <div className="space-y-5">
            <h2 className="font-display max-w-lg text-[clamp(2rem,3.4vw,3.25rem)] font-semibold leading-[1.12] tracking-[-0.035em]">
              {t('auth.title')}{' '}
              <span className="mt-1 block bg-gradient-to-r from-violet-500 via-primary to-indigo-500 bg-clip-text text-transparent">
                {t('auth.titleAccent')}
              </span>
            </h2>
            <p className="max-w-lg text-[0.9375rem] leading-7 text-slate-600">
              {t('auth.description')}
            </p>
          </div>
          <ul className="grid gap-3 text-[0.8125rem]">
            {highlights.map((item) => (
              <li
                key={item}
                className="auth-highlight flex items-center gap-3 rounded-xl px-4 py-3"
              >
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                <span className="font-medium text-slate-700">{t(item)}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative flex items-center gap-2 text-xs text-slate-500">
          <ShieldCheck className="h-4 w-4 text-emerald-500" />
          {t('auth.securedBy')}
        </div>
      </section>

      <section className="auth-form-pane relative flex min-h-screen items-center justify-center px-4 py-10 sm:px-8 lg:px-12">
        <div className="absolute right-5 top-5">
          <LocaleSwitcher compact />
        </div>
        <Link
          href="/"
          className="absolute left-3 top-5 inline-flex h-10 items-center gap-2 rounded-lg px-2 text-xs font-semibold text-slate-500 transition-colors hover:bg-white/75 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:left-5 lg:hidden"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> {t('auth.backHome')}
        </Link>

        <div className="w-full max-w-md animate-slide-up">
          <div className="mb-7 text-center lg:text-left">
            <div className="mx-auto mb-5 flex items-center justify-center lg:hidden">
              <span className="brand-mark h-11 w-11 text-base">M</span>
            </div>
            {step && (
              <p className="mb-2 text-2xs font-semibold uppercase tracking-[0.16em] text-primary">
                {step}
              </p>
            )}
            <h1 className="font-display text-[1.75rem] font-semibold tracking-[-0.03em] text-slate-950 sm:text-[2rem]">
              {title}
            </h1>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-600 lg:mx-0">
              {description}
            </p>
          </div>

          <div className="auth-card rounded-[1.5rem] p-5 sm:p-7">{children}</div>
          <div className="mt-5 flex min-h-8 items-center justify-center text-center text-xs text-slate-500 sm:mt-6">
            {footer}
          </div>
        </div>
      </section>
    </main>
  );
}

export function AuthMessage({
  children,
  tone = 'error',
}: {
  children: ReactNode;
  tone?: 'error' | 'success' | 'info';
}) {
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn(
        'flex items-start gap-2.5 rounded-xl border px-3 py-2.5 text-xs leading-5',
        tone === 'error' && 'border-destructive/20 bg-destructive/10 text-destructive',
        tone === 'success' && 'border-success/20 bg-success/10 text-success',
        tone === 'info' && 'border-primary/15 bg-primary/10 text-foreground',
      )}
    >
      <span
        className={cn(
          'mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full',
          tone === 'error' && 'bg-destructive',
          tone === 'success' && 'bg-success',
          tone === 'info' && 'bg-primary',
        )}
      />
      <span>{children}</span>
    </div>
  );
}
