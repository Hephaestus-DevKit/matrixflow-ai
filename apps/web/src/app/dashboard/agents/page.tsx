'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Bot, Plus } from 'lucide-react';
import type { AgentSummary } from '@matrixflow/shared';
import { EmptyState, ErrorState, LoadingCards } from '@/components/ui/states';
import { PageHeader } from '@/components/ui/page';

export default function AgentListPage() {
  const {
    data: agents,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['agents'],
    queryFn: () => apiClient.get<AgentSummary[]>('/agents'),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="AI workforce"
        title="AI 员工"
        description="创建、分配并协同具备专业领域认知的 AI 员工。"
        actions={
          <Button asChild className="gap-1.5 text-xs font-semibold">
            <Link href="/dashboard/agents/new">
              <Plus className="h-3.5 w-3.5" /> 创建员工
            </Link>
          </Button>
        }
      />

      {isLoading && <LoadingCards />}
      {isError && <ErrorState onRetry={() => void refetch()} />}

      {!isLoading && !isError && (!agents || agents.length === 0) && (
        <EmptyState
          icon={Bot}
          title="暂无 AI 员工"
          description="从岗位模板创建第一个 AI 员工，并为其配置模型、技能和知识库。"
          action={
            <Button asChild size="sm" variant="outline" className="text-xs">
              <Link href="/dashboard/agents/new">从模板部署</Link>
            </Button>
          }
        />
      )}

      {agents && agents.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {agents.map((a) => (
            <Link
              key={a.id}
              href={`/dashboard/agents/${a.id}`}
              className="interactive-card group flex flex-col justify-between p-5"
            >
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/5 text-primary">
                    <Bot className="h-4.5 w-4.5" />
                  </div>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[0.6875rem] font-bold ${
                      a.status === 'ACTIVE'
                        ? 'bg-success/5 border-success/15 text-success'
                        : 'bg-muted border-border text-muted-foreground'
                    }`}
                  >
                    {a.status === 'ACTIVE' ? '运行中' : a.status === 'DRAFT' ? '草稿' : '已归档'}
                  </span>
                </div>
                <h3 className="mt-4 font-bold text-foreground text-sm group-hover:text-primary transition-colors">
                  {a.name}
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">{a.role}</p>
              </div>

              <div className="mt-5 border-t border-border/40 pt-3 flex flex-wrap gap-1">
                {a.skills && a.skills.length > 0 ? (
                  a.skills.slice(0, 3).map((s) => (
                    <span
                      key={s.skillKey}
                      className="rounded-md border border-border/50 bg-muted px-2 py-0.5 text-[0.6875rem] font-medium text-muted-foreground"
                    >
                      {s.skillKey}
                    </span>
                  ))
                ) : (
                  <span className="text-[0.6875rem] text-muted-foreground">暂无绑定技能</span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
