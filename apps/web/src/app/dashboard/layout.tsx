'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-store';
import { Sidebar } from '@/components/sidebar';
import { Topbar } from '@/components/topbar';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, fetchMe } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    fetchMe().then(() => {
      setChecking(false);
      if (!useAuth.getState().user) {
        router.replace('/login');
      }
    });
  }, []);

  // Sync logout action: when initialized and user becomes null, immediately redirect to login page
  useEffect(() => {
    if (!checking && !user) {
      router.replace('/login');
    }
  }, [user, checking]);

  if (checking || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground bg-background">
        <div className="flex flex-col items-center gap-2">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent animate-pulse-glow"></div>
          <p className="text-sm font-semibold tracking-wide animate-pulse">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <div className="pl-56">
        <Topbar />
        <main className="p-6">
          {/* Silky smooth page transition using React key remounting */}
          <div key={pathname} className="animate-slide-up">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
