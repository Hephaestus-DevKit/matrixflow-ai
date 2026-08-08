'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, Home, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Keep detailed diagnostics in the browser while the UI exposes a safe message.
    console.error(error);
  }, [error]);

  return (
    <main id="main-content" className="flex min-h-screen items-center justify-center px-5">
      <section className="surface-card w-full max-w-lg p-8 text-center sm:p-10">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
          <AlertTriangle className="h-7 w-7" />
        </span>
        <p className="mt-5 text-xs font-bold uppercase tracking-[0.18em] text-destructive">
          Unexpected error
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">页面暂时无法使用</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          系统已保留本次错误信息。您可以重新加载当前页面，或返回首页继续操作。
        </p>
        {error.digest && (
          <p className="mt-3 font-mono text-[0.6875rem] text-muted-foreground">
            错误编号：{error.digest}
          </p>
        )}
        <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
          <Button onClick={reset} className="gap-2">
            <RotateCcw className="h-4 w-4" /> 重新加载
          </Button>
          <Button variant="outline" asChild className="gap-2">
            <Link href="/">
              <Home className="h-4 w-4" /> 返回首页
            </Link>
          </Button>
        </div>
      </section>
    </main>
  );
}
