'use client';

import { Languages } from 'lucide-react';
import { LOCALE_OPTIONS, useLocale } from '@/lib/i18n';

export function LocaleSwitcher({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale, t } = useLocale();

  return (
    <label
      className={
        compact
          ? 'inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg border border-border/70 bg-background/70 px-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 sm:px-2'
          : 'inline-flex h-10 shrink-0 items-center gap-2 rounded-lg border border-border/70 bg-background/70 px-3 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2'
      }
    >
      <Languages className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span className="sr-only">{t('common.language')}</span>
      <select
        value={locale}
        onChange={(event) => setLocale(event.target.value as typeof locale)}
        aria-label={t('common.language')}
        className="cursor-pointer appearance-none bg-transparent pr-0 text-inherit outline-none"
      >
        {LOCALE_OPTIONS.map((option) => (
          <option key={option.value} value={option.value} className="bg-background text-foreground">
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
