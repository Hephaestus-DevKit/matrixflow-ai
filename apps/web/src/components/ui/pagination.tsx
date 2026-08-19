'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLocale } from '@/lib/i18n';

const COPY = {
  'zh-CN': {
    previous: '上一页',
    next: '下一页',
    summary: (start: number, end: number, total: number) => `第 ${start}–${end} 项，共 ${total} 项`,
  },
  'zh-TW': {
    previous: '上一頁',
    next: '下一頁',
    summary: (start: number, end: number, total: number) => `第 ${start}–${end} 項，共 ${total} 項`,
  },
  en: {
    previous: 'Previous',
    next: 'Next',
    summary: (start: number, end: number, total: number) => `${start}–${end} of ${total}`,
  },
} as const;

export function PaginationBar({
  offset,
  limit,
  total,
  nextOffset,
  onChange,
}: {
  offset: number;
  limit: number;
  total: number;
  nextOffset: number | null;
  onChange: (offset: number) => void;
}) {
  const { locale } = useLocale();
  const copy = COPY[locale];
  if (total <= limit && offset === 0) return null;
  const start = total === 0 ? 0 : offset + 1;
  const end = Math.min(total, offset + limit);

  return (
    <nav
      aria-label={locale === 'en' ? 'Pagination' : locale === 'zh-TW' ? '分頁' : '分页'}
      className="surface-card flex flex-col gap-3 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
    >
      <p className="px-1 text-xs font-medium tabular-nums text-muted-foreground">
        {copy.summary(start, end, total)}
      </p>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="min-h-10 flex-1 gap-1.5 sm:flex-none"
          disabled={offset === 0}
          onClick={() => onChange(Math.max(0, offset - limit))}
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          {copy.previous}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="min-h-10 flex-1 gap-1.5 sm:flex-none"
          disabled={nextOffset === null}
          onClick={() => nextOffset !== null && onChange(nextOffset)}
        >
          {copy.next}
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
    </nav>
  );
}
