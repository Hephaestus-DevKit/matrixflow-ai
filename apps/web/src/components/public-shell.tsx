import Link from 'next/link';
import { Button } from '@/components/ui/button';

export function PublicHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5 font-bold tracking-tight">
          <span className="brand-mark h-8 w-8 rounded-lg" aria-hidden="true">
            M
          </span>
          MatrixFlow AI
        </Link>
        <nav aria-label="公开页面导航" className="flex items-center gap-1 sm:gap-2">
          <Link href="/pricing" className="hidden sm:block">
            <Button variant="ghost" size="sm">
              定价
            </Button>
          </Link>
          <Link href="/login">
            <Button variant="ghost" size="sm">
              登录
            </Button>
          </Link>
          <Link href="/register">
            <Button size="sm">免费开始</Button>
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className="border-t border-border/60 px-4 py-8 text-xs text-muted-foreground">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
        <span>© 2026 MatrixFlow AI · Appwrite 原生 AI 运营工作台</span>
        <nav aria-label="法律信息" className="flex flex-wrap justify-center gap-x-4 gap-y-2">
          <Link href="/pricing" className="hover:text-foreground">
            定价
          </Link>
          <Link href="/terms" className="hover:text-foreground">
            服务条款
          </Link>
          <Link href="/privacy" className="hover:text-foreground">
            隐私政策
          </Link>
          <a
            href="https://github.com/Hephaestus-DevKit/matrixflow-ai/security"
            target="_blank"
            rel="noreferrer"
            className="hover:text-foreground"
          >
            安全
          </a>
        </nav>
      </div>
    </footer>
  );
}
