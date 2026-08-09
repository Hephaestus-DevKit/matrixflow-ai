import Link from 'next/link';
import { ArrowLeft, Compass } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <main id="main-content" className="flex min-h-screen items-center justify-center px-5">
      <section className="surface-card w-full max-w-lg p-8 text-center sm:p-10">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Compass className="h-7 w-7" />
        </span>
        <p className="mt-5 text-xs font-bold uppercase tracking-[0.18em] text-primary">
          404 · Not found
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">这个页面不存在</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          链接可能已经失效，或者该资源已被移动。
        </p>
        <Button asChild className="mt-6 gap-2">
          <Link href="/">
            <ArrowLeft className="h-4 w-4" /> 返回首页
          </Link>
        </Button>
      </section>
    </main>
  );
}
