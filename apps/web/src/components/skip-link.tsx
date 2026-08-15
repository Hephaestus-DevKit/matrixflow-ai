'use client';

import { useLocale } from '@/lib/i18n';

export function SkipLink() {
  const { t } = useLocale();

  return (
    <a
      href="#main-content"
      className="fixed left-4 top-3 z-[100] -translate-y-20 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-lg transition-transform focus:translate-y-0"
    >
      {t('common.skipToContent')}
    </a>
  );
}
