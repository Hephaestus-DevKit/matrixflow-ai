'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { GitFork, Plus, ArrowRight } from 'lucide-react';
import type { WorkflowSummary } from '@matrixflow/shared';
import { EmptyState, ErrorState, LoadingCards } from '@/components/ui/states';
import { PageHeader } from '@/components/ui/page';

export default function WorkflowListPage() {
  const {
    data: wfs,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['wfs'],
    queryFn: () => apiClient.get<WorkflowSummary[]>('/workflows'),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Automation"
        title="工作流"
        description="通过可视化画布编排和运行自动化 AI 流水线。"
        actions={
          <Link href="/dashboard/workflows/new">
            <Button className="gap-1.5 text-xs font-semibold">
              <Plus className="h-3.5 w-3.5" /> 新建工作流
            </Button>
          </Link>
        }
      />

      {isLoading && <LoadingCards count={2} />}
      {isError && <ErrorState onRetry={() => void refetch()} />}

      {!isLoading && !isError && wfs && wfs.length === 0 && (
        <EmptyState
          icon={GitFork}
          title="暂无工作流自动化"
          description="使用流程画布将 AI、逻辑判断与第三方 API 连接为自动化生产线。"
          action={
            <Link href="/dashboard/workflows/new">
              <Button size="sm" variant="outline" className="text-xs">
                创建第一个工作流
              </Button>
            </Link>
          }
        />
      )}

      {wfs && wfs.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {wfs.map((w) => (
            <Link
              key={w.id}
              href={`/dashboard/workflows/${w.id}`}
              className="interactive-card group flex items-center justify-between p-5"
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
