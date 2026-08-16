'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-store';
import { DashboardShell } from '@/components/dashboard-shell';
import { PageLoader } from '@/components/ui/states';
import { useLocale } from '@/lib/i18n';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { locale } = useLocale();
  const { user, fetchMe } = useAuth();
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let active = true;
    fetchMe()
      .catch(() => undefined)
      .finally(() => {
        if (!active) return;
        setChecking(false);
        if (!useAuth.getState().user) router.replace('/login');
      });
    return () => {
      active = false;
    };
  }, [fetchMe, router]);

  // Sync logout action: when initialized and user becomes null, immediately redirect to login page
  useEffect(() => {
    if (!checking && !user) {
      router.replace('/login');
    }
  }, [user, checking, router]);

  if (checking || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <PageLoader
          label={
            locale === 'en'
              ? 'Loading workspace'
              : locale === 'zh-TW'
                ? '正在載入工作台'
                : '正在加载工作台'
          }
        />
      </div>
    );
  }

  return <DashboardShell>{children}</DashboardShell>;
}
