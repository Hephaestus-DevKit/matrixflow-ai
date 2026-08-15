'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { Cloud, X } from 'lucide-react';
import { useAuth } from '@/lib/auth-store';
import { cn } from '@/lib/cn';
import { DASHBOARD_NAVIGATION } from '@/components/dashboard-navigation';
import { useLocale } from '@/lib/i18n';

export function Sidebar({ mobile = false, onClose }: { mobile?: boolean; onClose?: () => void }) {
  const pathname = usePathname();
  const { user, organizationId } = useAuth();
  const membership = user?.memberships.find((item) => item.organizationId === organizationId);
  const { t } = useLocale();

  return (
    <aside
      className={cn(
        'inset-y-0 left-0 flex w-64 flex-col border-r border-border/70 bg-card/95 shadow-sm backdrop-blur-xl',
        mobile ? 'h-full' : 'fixed z-40 hidden lg:flex',
      )}
    >
      <div className="flex h-16 items-center gap-3 border-b border-border/70 px-4">
        <Link
          href="/dashboard"
          className="flex min-w-0 flex-1 items-center gap-3 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={onClose}
        >
          <span className="brand-mark" aria-hidden="true">
            M
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-bold tracking-tight">MatrixFlow AI</span>
            <span className="block text-[0.6875rem] font-semibold tracking-wide text-muted-foreground">
              AI 运营工作台
            </span>
          </span>
        </Link>
        {mobile && (
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="关闭导航"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <nav aria-label="主导航" className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
        {DASHBOARD_NAVIGATION.map((group) => (
          <div key={group.label}>
            <p className="mb-2 px-3 text-[0.6875rem] font-bold tracking-wide text-muted-foreground">
              {t(group.labelKey)}
            </p>
            <div className="space-y-1">
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive =
                  pathname === item.href ||
                  (item.href !== '/dashboard' && pathname.startsWith(`${item.href}/`));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onClose}
                    aria-current={isActive ? 'page' : undefined}
                    className={cn(
                      'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      isActive
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground',
                    )}
                  >
                    <span
                      className={cn(
                        'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors',
                        isActive
                          ? 'bg-primary text-primary-foreground shadow-glow-sm'
                          : 'bg-muted/70',
                      )}
                    >
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate leading-4">{t(item.labelKey)}</span>
                      <span className="mt-0.5 block truncate text-[0.6875rem] font-normal text-muted-foreground">
                        {t(item.descriptionKey)}
                      </span>
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-border/70 p-3">
        <div className="mb-2 flex items-center gap-2 rounded-xl border border-border/70 bg-muted/35 px-3 py-2 text-[0.6875rem] text-muted-foreground">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Cloud className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="block truncate font-semibold text-foreground">
              {t('common.hostedData')}
            </span>
            <span className="block text-[0.6875rem] text-muted-foreground">
              {t('common.appwrite')}
            </span>
          </span>
        </div>
        <Link
          href="/dashboard/settings"
          onClick={onClose}
          className="flex items-center gap-3 rounded-xl p-2.5 transition-colors hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {user?.avatarUrl ? (
            <Image
              src={user.avatarUrl}
              alt=""
              width={36}
              height={36}
              unoptimized
              className="h-9 w-9 rounded-xl border border-border object-cover"
            />
          ) : (
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-sm font-bold uppercase text-primary">
              {user?.name?.[0] ?? '?'}
            </span>
          )}
          <span className="min-w-0 flex-1">
            <span className="block truncate text-xs font-bold">{user?.name ?? '个人用户'}</span>
            <span className="mt-0.5 block truncate text-[0.6875rem] text-muted-foreground">
              {membership?.organizationName ?? user?.email ?? ''}
            </span>
          </span>
        </Link>
      </div>
    </aside>
  );
}
