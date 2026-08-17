'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useTheme } from 'next-themes';
import { LogOut, Menu, Moon, Sun } from 'lucide-react';
import { useAuth } from '@/lib/auth-store';
import { Button } from '@/components/ui/button';
import { navigationItemForPath } from '@/components/dashboard-navigation';
import { useLocale } from '@/lib/i18n';
import { LocaleSwitcher } from '@/components/locale-switcher';

export function Topbar({ onOpenNavigation }: { onOpenNavigation: () => void }) {
  const pathname = usePathname();
  const { logout } = useAuth();
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const current = navigationItemForPath(pathname);
  const { t } = useLocale();

  useEffect(() => setMounted(true), []);

  return (
    <header className="dashboard-topbar sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border/60 px-4 backdrop-blur-2xl sm:px-6 lg:px-8">
      <div className="flex min-w-0 items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={onOpenNavigation}
          className="h-10 w-10 lg:hidden"
          aria-label={t('dashboard.openNavigation')}
        >
          <Menu className="h-5 w-5" />
        </Button>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-foreground">{t(current.labelKey)}</p>
          <p className="hidden truncate text-[0.6875rem] text-muted-foreground sm:block">
            {t(current.descriptionKey)}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        <LocaleSwitcher compact />
        {mounted && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
            className="h-10 w-10 text-muted-foreground"
            aria-label={resolvedTheme === 'dark' ? t('common.theme.light') : t('common.theme.dark')}
          >
            {resolvedTheme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
        )}
        <span className="mx-1 h-5 w-px bg-border" aria-hidden="true" />
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void logout()}
          aria-label={t('dashboard.logoutAria')}
          className="h-10 gap-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
        >
          <LogOut className="h-4 w-4" />
          <span className="hidden sm:inline">{t('dashboard.logout')}</span>
        </Button>
      </div>
    </header>
  );
}
