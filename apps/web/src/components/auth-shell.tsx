import type { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, ShieldCheck, Sparkles } from 'lucide-react';
import { cn } from '@/lib/cn';

const highlights = [
  'Appwrite 托管身份与邮箱验证',
  '组织级权限与数据严格隔离',
  '会话自动续期与安全退出',
];

interface AuthShellProps {
  title: string;
  description: string;
  children: ReactNode;
  footer: ReactNode;
  step?: string;
}

export function AuthShell({ title, description, children, footer, step }: AuthShellProps) {
  return (
    <main
      id="main-content"
      className="relative grid min-h-screen overflow-hidden bg-background lg:grid-cols-[minmax(0,1.05fr)_minmax(430px,0.95fr)]"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_0%,hsl(var(--primary)/0.16),transparent_34rem),radial-gradient(circle_at_90%_100%,hsl(215_90%_55%/0.1),transparent_32rem)]" />

      <section className="relative hidden min-h-screen overflow-hidden border-r border-border/70 p-12 lg:flex lg:flex-col lg:justify-between xl:p-16">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,hsl(var(--border)/0.25)_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border)/0.25)_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:linear-gradient(to_bottom,black,transparent_85%)]" />
        <Link href="/" className="relative flex w-fit items-center gap-3">
          <span className="brand-mark h-11 w-11 text-base">M</span>
          <span>
            <span className="block text-sm font-black tracking-tight">MatrixFlow AI</span>
            <span className="block text-2xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              AI workforce OS
            </span>
          </span>
        </Link>

        <div className="relative max-w-xl space-y-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary">
            <Sparkles className="h-3.5 w-3.5" /> 一支随时在线的智能团队
          </div>
          <div className="space-y-4">
            <h2 className="max-w-lg text-4xl font-black leading-[1.08] tracking-tight xl:text-5xl">
              从身份验证开始，
              <span className="bg-gradient-to-r from-violet-500 via-primary to-indigo-500 bg-clip-text text-transparent">
                安全地驱动每次协作
              </span>
            </h2>
            <p className="max-w-lg text-sm leading-7 text-muted-foreground">
              登录后即可管理 AI 员工、知识库、自动化工作流与团队业务数据。
            </p>
          </div>
          <ul className="grid gap-3 text-sm">
            {highlights.map((item) => (
              <li
                key={item}
                className="flex items-center gap-3 rounded-xl border border-border/60 bg-card/55 px-4 py-3 backdrop-blur-sm"
              >
                <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
                <span className="font-medium">{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative flex items-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="h-4 w-4 text-success" />
          认证由 Appwrite 安全托管
        </div>
      </section>

      <section className="relative flex min-h-screen items-center justify-center px-4 py-10 sm:px-8 lg:px-12">
        <Link
          href="/"
          className="absolute left-5 top-5 inline-flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:hidden"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> 返回首页
        </Link>

        <div className="w-full max-w-md animate-slide-up">
          <div className="mb-7 text-center lg:text-left">
            <div className="mx-auto mb-5 flex items-center justify-center lg:hidden">
              <span className="brand-mark h-11 w-11 text-base">M</span>
            </div>
            {step && (
              <p className="mb-2 text-2xs font-bold uppercase tracking-[0.18em] text-primary">
                {step}
              </p>
            )}
            <h1 className="text-2xl font-black tracking-tight sm:text-3xl">{title}</h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
          </div>

          <div className="rounded-3xl border border-border/75 bg-card/82 p-5 shadow-[0_28px_80px_-38px_hsl(var(--foreground)/0.45)] backdrop-blur-xl sm:p-7">
            {children}
          </div>
          <div className="mt-6 text-center text-xs text-muted-foreground">{footer}</div>
        </div>
      </section>
    </main>
  );
}

export function AuthMessage({
  children,
  tone = 'error',
}: {
  children: ReactNode;
  tone?: 'error' | 'success' | 'info';
}) {
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn(
        'flex items-start gap-2.5 rounded-xl border px-3 py-2.5 text-xs leading-5',
        tone === 'error' && 'border-destructive/20 bg-destructive/10 text-destructive',
        tone === 'success' && 'border-success/20 bg-success/10 text-success',
        tone === 'info' && 'border-primary/15 bg-primary/10 text-foreground',
      )}
    >
      <span
        className={cn(
          'mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full',
          tone === 'error' && 'bg-destructive',
          tone === 'success' && 'bg-success',
          tone === 'info' && 'bg-primary',
        )}
      />
      <span>{children}</span>
    </div>
  );
}
