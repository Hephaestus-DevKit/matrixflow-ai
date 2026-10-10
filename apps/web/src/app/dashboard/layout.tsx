'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-store';
import { DashboardShell } from '@/components/dashboard-shell';
import { ErrorState, PageLoader } from '@/components/ui/states';
import { useLocale } from '@/lib/i18n';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { locale } = useLocale();
  const { user, fetchMe } = useAuth();
  const router = useRouter();
  const [checking, setChecking] = useState(() => !useAuth.getState().user);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (useAuth.getState().user) {
      setChecking(false);
      return;
    }
    let active = true;
    setChecking(true);
    setFailed(false);
    fetchMe(12_000)
      .catch((error: unknown) => {
        if (!active) return;
        const candidate = error as { code?: unknown; status?: number; type?: string };
        if (
          Number(candidate.code) === 401 ||
          candidate.status === 401 ||
          candidate.code === 'UNAUTHENTICATED' ||
          candidate.type === 'user_unauthorized'
        ) {
          const next = `${window.location.pathname}${window.location.search}`;
          router.replace(`/login?next=${encodeURIComponent(next)}`);
        } else {
          setFailed(true);
        }
      })
      .finally(() => {
        if (active) setChecking(false);
      });
    return () => {
      active = false;
    };
  }, [attempt, fetchMe, router]);
  useEffect(() => {
    if (!checking && !failed && !user)
      router.replace(
        `/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`,
      );
  }, [user, checking, failed, router]);
  if (failed && !user)
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="w-full max-w-lg">
          <ErrorState onRetry={() => setAttempt((value) => value + 1)} />
        </div>
      </div>
    );
  if (checking || !user)
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
  return <DashboardShell>{children}</DashboardShell>;
}
