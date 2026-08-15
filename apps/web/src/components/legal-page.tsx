'use client';

import type { ReactNode } from 'react';
import { PublicFooter, PublicHeader } from '@/components/public-shell';
import { useLocale } from '@/lib/i18n';

export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: ReactNode;
}) {
  const { locale } = useLocale();
  const legalLabel = locale === 'en' ? 'Legal' : locale === 'zh-TW' ? '法律資訊' : '法律信息';
  const updatedLabel =
    locale === 'en'
      ? 'Effective and last updated'
      : locale === 'zh-TW'
        ? '生效及最近更新'
        : '生效及最近更新';
  return (
    <div className="min-h-screen bg-background text-foreground">
      <PublicHeader />
      <main id="main-content" className="mx-auto max-w-3xl px-4 py-14 sm:px-6 sm:py-20">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">{legalLabel}</p>
        <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">{title}</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          {updatedLabel}: {updated}
        </p>
        <article className="mt-10 space-y-8 text-sm leading-7 text-muted-foreground [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-foreground [&_li]:ml-5 [&_li]:list-disc [&_p]:mt-3">
          {children}
        </article>
      </main>
      <PublicFooter />
    </div>
  );
}
