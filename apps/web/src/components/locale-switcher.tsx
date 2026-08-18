'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Check, ChevronDown, Languages } from 'lucide-react';
import { cn } from '@/lib/cn';
import { LOCALE_OPTIONS, useLocale, type Locale } from '@/lib/i18n';

const LOCALE_CODES: Record<Locale, string> = {
  'zh-CN': '简',
  'zh-TW': '繁',
  en: 'EN',
};

export function LocaleSwitcher({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale, t } = useLocale();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const current = LOCALE_OPTIONS.find((option) => option.value === locale) ?? LOCALE_OPTIONS[0];

  useEffect(() => {
    if (!open) return;
    const closeFromOutside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeFromEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener('pointerdown', closeFromOutside);
    document.addEventListener('keydown', closeFromEscape);
    window.requestAnimationFrame(() => {
      menuRef.current
        ?.querySelector<HTMLButtonElement>('[role="option"][aria-selected="true"]')
        ?.focus();
    });
    return () => {
      document.removeEventListener('pointerdown', closeFromOutside);
      document.removeEventListener('keydown', closeFromEscape);
    };
  }, [open]);

  function chooseLocale(value: Locale) {
    setLocale(value);
    setOpen(false);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  }

  function moveOptionFocus(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    const options = Array.from(
      menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="option"]') ?? [],
    );
    const activeIndex = Math.max(0, options.indexOf(document.activeElement as HTMLButtonElement));
    const direction = event.key === 'ArrowDown' ? 1 : -1;
    options[(activeIndex + direction + options.length) % options.length]?.focus();
  }

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={`${t('common.language')}: ${current.label}`}
        data-testid="locale-switcher-trigger"
        data-locale={locale}
        onClick={() => setOpen((value) => !value)}
        className={cn(
          'group inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-slate-200/80 bg-white/75 text-xs font-semibold text-slate-600 shadow-[0_10px_26px_-22px_rgb(30_41_59/0.5)] backdrop-blur-xl transition-[border-color,background-color,box-shadow,color] hover:border-primary/25 hover:bg-white hover:text-slate-950 hover:shadow-[0_14px_30px_-22px_rgb(79_70_229/0.42)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 dark:border-white/10 dark:bg-white/[0.055] dark:text-slate-300 dark:hover:bg-white/[0.09] dark:hover:text-white',
          compact ? 'px-2.5' : 'px-3',
          open &&
            'border-primary/30 bg-white text-slate-950 shadow-[0_14px_34px_-22px_rgb(79_70_229/0.5)]',
        )}
      >
        <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary/15 dark:bg-primary/15">
          <Languages className="h-3.5 w-3.5" aria-hidden="true" />
        </span>
        <span className={cn('whitespace-nowrap', compact && 'hidden min-[500px]:inline')}>
          {current.label}
        </span>
        <ChevronDown
          className={cn(
            'h-3.5 w-3.5 text-slate-400 transition-transform duration-200',
            compact && 'hidden min-[500px]:block',
            open && 'rotate-180 text-primary',
          )}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div
          ref={menuRef}
          id={menuId}
          role="listbox"
          aria-label={t('common.language')}
          onKeyDown={moveOptionFocus}
          className="absolute right-0 top-full z-[80] mt-2 w-48 origin-top-right animate-slide-up overflow-hidden rounded-2xl border border-slate-200/90 bg-white/95 p-1.5 shadow-[0_24px_70px_-30px_rgb(30_41_59/0.45)] backdrop-blur-2xl dark:border-white/10 dark:bg-slate-950/95"
        >
          <div className="px-2.5 pb-1.5 pt-1 text-2xs font-semibold uppercase tracking-[0.14em] text-slate-400">
            {t('common.language')}
          </div>
          {LOCALE_OPTIONS.map((option) => {
            const selected = option.value === locale;
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={selected}
                data-testid={`locale-option-${option.value}`}
                onClick={() => chooseLocale(option.value)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
                  selected
                    ? 'bg-primary/10 text-primary'
                    : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/[0.07] dark:hover:text-white',
                )}
              >
                <span
                  className={cn(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border text-2xs font-bold',
                    selected
                      ? 'border-primary/20 bg-white text-primary shadow-sm dark:bg-white/10'
                      : 'border-slate-200 bg-slate-50 text-slate-500 dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-400',
                  )}
                  aria-hidden="true"
                >
                  {LOCALE_CODES[option.value]}
                </span>
                <span className="min-w-0 flex-1 font-medium">{option.label}</span>
                <Check
                  className={cn('h-4 w-4 text-primary', !selected && 'opacity-0')}
                  aria-hidden="true"
                />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
