'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Bot, Plus } from 'lucide-react';

export default function AgentListPage() {
  const { data: agents, isLoading } = useQuery({
    queryKey: ['agents'],
    queryFn: () => apiClient.get<any[]>('/agents'),
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between border-b border-border/40 pb-5">
        <div>
          <h1 className="text-xl font-bold tracking-tight">AI 员工</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            创建、分配并协同您团队中具备专业领域认知的 AI 员工
          </p>
        </div>
        <Link href="/dashboard/agents/new">
          <Button className="gap-1.5 text-xs font-semibold">
            <Plus className="h-3.5 w-3.5" /> 创建员工
          </Button>
        </Link>
      </div>

      {isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="rounded-xl border border-border/60 bg-card p-5 space-y-4 animate-pulse"
            >
              <div className="flex items-center justify-between">
                <div className="h-9 w-9 rounded-lg bg-muted"></div>
                <div className="h-5 w-12 rounded-full bg-muted"></div>
              </div>
              <div className="space-y-2">
                <div className="h-4 w-1/2 rounded bg-muted"></div>
                <div className="h-3.5 w-1/3 rounded bg-muted"></div>
              </div>
              <div className="border-t border-border/40 pt-3 flex gap-1">
                <div className="h-4 w-12 rounded bg-muted"></div>
                <div className="h-4 w-16 rounded bg-muted"></div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!isLoading && (!agents || agents.length === 0) && (
        <div className="rounded-xl border border-dashed border-border/60 bg-muted/10 p-12 text-center flex flex-col items-center justify-center">
          <Bot className="h-10 w-10 text-muted-foreground/60 mb-3 animate-pulse-slow" />
          <p className="text-sm font-semibold text-foreground">暂无 AI 员工</p>
          <p className="mt-1 text-xs text-muted-foreground max-w-[280px]">
            您目前没有部署任何 AI 员工。点击下方从官方岗位模板库一键部署。
          </p>
          <Link href="/dashboard/agents/new" className="mt-4">
            <Button size="sm" variant="outline" className="text-xs">
              从模板部署
            </Button>
          </Link>
        </div>
      )}

      {agents && agents.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {agents.map((a: any) => (
            <Link
              key={a.id}
              href={`/dashboard/agents/${a.id}`}
              className="group rounded-xl border border-border/60 bg-card p-5 transition-all duration-300 hover:border-primary/30 hover:shadow-sm flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/5 text-primary">
                    <Bot className="h-4.5 w-4.5" />
                  </div>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      a.status === 'active' || a.status === 'idle'
                        ? 'bg-success/5 border-success/15 text-success'
                        : 'bg-muted border-border text-muted-foreground'
                    }`}
                  >
                    {a.status === 'active' ? '运行中' : '空闲'}
                  </span>
                </div>
                <h3 className="mt-4 font-bold text-foreground text-sm group-hover:text-primary transition-colors">
                  {a.name}
                </h3>
                <p className="text-2xs text-muted-foreground mt-0.5 uppercase tracking-wide">
                  {a.role}
                </p>
              </div>

              <div className="mt-5 border-t border-border/40 pt-3 flex flex-wrap gap-1">
                {a.skills && a.skills.length > 0 ? (
                  a.skills.slice(0, 3).map((s: any) => (
                    <span
                      key={s.skillKey}
                      className="rounded-md bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground border border-border/50"
                    >
                      {s.skillKey}
                    </span>
                  ))
                ) : (
                  <span className="text-[10px] text-muted-foreground">暂无绑定技能</span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
