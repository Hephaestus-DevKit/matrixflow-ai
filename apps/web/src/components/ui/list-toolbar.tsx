'use client';

import { Search, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useLocale } from '@/lib/i18n';

const COPY = {
  'zh-CN': { label: '筛选当前页', placeholder: '筛选当前页…', clear: '清除筛选' },
  'zh-TW': { label: '篩選目前頁面', placeholder: '篩選目前頁面…', clear: '清除篩選' },
  en: { label: 'Filter this page', placeholder: 'Filter this page…', clear: 'Clear filter' },
} as const;

export function ListToolbar({
  value,
  onChange,
  resultLabel,
  placeholder,
  children,
}: {
  value: string;
  onChange: (value: string) => void;
  resultLabel: string;
  placeholder?: string;
  children?: ReactNode;
}) {
  const { locale } = useLocale();
  const copy = COPY[locale];

  return (
    <div className="panel-card flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="relative min-w-0 flex-1 sm:max-w-sm">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          type="search"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-label={copy.label}
          placeholder={placeholder ?? copy.placeholder}
          className="h-10 pl-9 pr-10"
        />
        {value && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => onChange('')}
            aria-label={copy.clear}
            className="absolute right-0.5 top-1/2 h-9 w-9 -translate-y-1/2 text-muted-foreground"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 sm:justify-end">
        <p aria-live="polite" className="text-xs font-medium tabular-nums text-muted-foreground">
          {resultLabel}
        </p>
        {children}
      </div>
    </div>
  );
}
