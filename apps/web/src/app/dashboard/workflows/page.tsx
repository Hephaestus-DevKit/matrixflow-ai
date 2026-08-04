'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { GitFork, Plus, ArrowRight } from 'lucide-react';

export default function WorkflowListPage() {
  const { data: wfs, isLoading } = useQuery({
    queryKey: ['wfs'],
    queryFn: () => apiClient.get<any[]>('/workflows'),
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between border-b border-border/40 pb-5">
        <div>
          <h1 className="text-xl font-bold tracking-tight">工作流</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            通过拖拽画布可视化编排和运行您的自动化 AI 流水线
          </p>
        </div>
        <Link href="/dashboard/workflows/new">
          <Button className="gap-1.5 text-xs font-semibold">
            <Plus className="h-3.5 w-3.5" /> 新建工作流
          </Button>
        </Link>
      </div>

      {isLoading && (
        <div className="grid gap-4 sm:grid-cols-2">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="rounded-xl border border-border/60 bg-card p-5 space-y-4 animate-pulse"
            >
              <div className="flex items-center justify-between">
                <div className="h-9 w-9 rounded-lg bg-muted"></div>
                <div className="h-5 w-12 rounded-full bg-muted"></div>
              </div>
              <div className="space-y-2">
                <div className="h-4 w-1/3 rounded bg-muted"></div>
                <div className="h-3.5 w-2/3 rounded bg-muted"></div>
              </div>
              <div className="border-t border-border/40 pt-3 flex items-center justify-between">
                <div className="h-4 w-16 rounded bg-muted"></div>
                <div className="h-4 w-8 rounded bg-muted"></div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!isLoading && wfs && wfs.length === 0 && (
        <div className="rounded-xl border border-dashed border-border/60 bg-muted/10 p-12 text-center flex flex-col items-center justify-center">
          <GitFork className="h-10 w-10 text-muted-foreground/60 mb-3 animate-pulse-slow rotate-90" />
          <p className="text-sm font-semibold text-foreground">暂无工作流自动化</p>
          <p className="mt-1 text-xs text-muted-foreground max-w-[280px]">
            使用流程画布将 AI 角色、逻辑判定和第三方 API 粘合为一条自动化生产线。
          </p>
          <Link href="/dashboard/workflows/new" className="mt-4">
            <Button size="sm" variant="outline" className="text-xs">
              创建第一个工作流
            </Button>
          </Link>
        </div>
      )}

      {wfs && wfs.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {wfs.map((w) => (
            <Link
              key={w.id}
              href={`/dashboard/workflows/${w.id}`}
              className="group rounded-xl border border-border/60 bg-card p-5 transition-all duration-300 hover:border-primary/30 hover:shadow-sm flex items-center justify-between"
            >
              <div className="flex items-center gap-3.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/5 text-primary group-hover:bg-primary/10 transition-colors">
                  <GitFork className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-foreground text-sm group-hover:text-primary transition-colors">
                    {w.name}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {w._count?.runs ?? 0} 次历史运行 · 版本 v{w.currentVersion}
                  </p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
