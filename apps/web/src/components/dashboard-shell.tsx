'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar } from '@/components/sidebar';
import { Topbar } from '@/components/topbar';

export function DashboardShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [navigationOpen, setNavigationOpen] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => setNavigationOpen(false), [pathname]);
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

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      {navigationOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="关闭导航"
            className="absolute inset-0 bg-slate-950/55 backdrop-blur-sm"
            onClick={() => setNavigationOpen(false)}
          />
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label="主导航"
            className="relative h-full w-72"
          >
            <Sidebar mobile onClose={() => setNavigationOpen(false)} />
          </div>
        </div>
      )}
      <div className="lg:pl-64">
        <Topbar
          onOpenNavigation={() => {
            previousFocusRef.current = document.activeElement as HTMLElement | null;
            setNavigationOpen(true);
          }}
        />
        <main id="main-content" className="px-4 py-5 sm:px-6 sm:py-7 lg:px-8 lg:py-8">
          <div key={pathname} className="mx-auto w-full max-w-[1520px] animate-slide-up">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
