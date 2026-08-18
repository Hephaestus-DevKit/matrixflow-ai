'use client';

import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar } from '@/components/sidebar';
import { Topbar } from '@/components/topbar';
import { useLocale } from '@/lib/i18n';

export function DashboardShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [navigationOpen, setNavigationOpen] = useState(false);
  const [navigationPending, setNavigationPending] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const { t } = useLocale();

  useEffect(() => {
    setNavigationOpen(false);
    setNavigationPending(false);
  }, [pathname]);
  useEffect(() => {
    if (!navigationPending) return;
    const timeout = window.setTimeout(() => setNavigationPending(false), 10_000);
    return () => window.clearTimeout(timeout);
  }, [navigationPending]);
  useEffect(() => {
    if (!navigationOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setNavigationOpen(false);
      if (event.key !== 'Tab') return;
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.requestAnimationFrame(() => {
      dialogRef.current?.querySelector<HTMLElement>('a[href], button')?.focus();
    });
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocusRef.current?.focus();
    };
  }, [navigationOpen]);

  function handleNavigationIntent(event: MouseEvent<HTMLDivElement>) {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    const anchor = target.closest<HTMLAnchorElement>('a[href]');
    if (!anchor || anchor.target === '_blank' || anchor.hasAttribute('download')) return;
    const destination = new URL(anchor.href, window.location.href);
    if (
      destination.origin === window.location.origin &&
      destination.pathname.startsWith('/dashboard') &&
      `${destination.pathname}${destination.search}` !== `${pathname}${window.location.search}`
    )
      setNavigationPending(true);
  }

  return (
    <div
      className="dashboard-shell relative isolate min-h-screen overflow-x-clip"
      onClickCapture={handleNavigationIntent}
    >
      {navigationPending && (
        <div
          role="status"
          aria-label={t('common.loadingContent')}
          className="fixed inset-x-0 top-0 z-[90] h-0.5 overflow-hidden bg-primary/10"
        >
          <span className="dashboard-navigation-progress block h-full bg-primary shadow-glow" />
        </div>
      )}
      <div
        className="dashboard-backdrop pointer-events-none fixed inset-y-0 right-0 z-0 left-0 lg:left-64"
        aria-hidden="true"
      >
        <div className="dashboard-grid absolute inset-0" />
        <div className="dashboard-glow dashboard-glow-violet" />
        <div className="dashboard-glow dashboard-glow-blue" />
        <div className="dashboard-sweep" />
      </div>
      <Sidebar />
      {navigationOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label={t('dashboard.closeNavigation')}
            className="absolute inset-0 bg-slate-950/55 backdrop-blur-sm"
            onClick={() => setNavigationOpen(false)}
          />
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label={t('dashboard.dialogNavigation')}
            className="relative h-full w-72"
          >
            <Sidebar mobile onClose={() => setNavigationOpen(false)} />
          </div>
        </div>
      )}
      <div className="relative z-10 lg:pl-64">
        <Topbar
          onOpenNavigation={() => {
            previousFocusRef.current = document.activeElement as HTMLElement | null;
            setNavigationOpen(true);
          }}
        />
        <main id="main-content" className="px-4 py-5 sm:px-6 sm:py-7 lg:px-8 lg:py-8">
          <div className="mx-auto w-full max-w-[1520px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
