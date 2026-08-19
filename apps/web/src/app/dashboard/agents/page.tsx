'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import Link from 'next/link';
import { apiClient, type ListPage } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Bot, Plus } from 'lucide-react';
import type { AgentSummary } from '@matrixflow/shared';
import { EmptyState, ErrorState, LoadingCards } from '@/components/ui/states';
import { PageHeader } from '@/components/ui/page';
import { useLocale, type Locale } from '@/lib/i18n';
import { PaginationBar } from '@/components/ui/pagination';

const PAGE_SIZE = 24;

const COPY: Record<
  Locale,
  {
    eyebrow: string;
    title: string;
    description: string;
    create: string;
    empty: string;
    emptyDescription: string;
    deploy: string;
    active: string;
    draft: string;
    archived: string;
    noSkills: string;
  }
> = {
  'zh-CN': {
    eyebrow: 'AI 员工',
    title: 'AI 员工',
    description: '创建、分配并协同具备专业领域认知的 AI 员工。',
    create: '创建员工',
    empty: '暂无 AI 员工',
    emptyDescription: '从岗位模板创建第一个 AI 员工，并为其配置模型、技能和知识库。',
    deploy: '从模板部署',
    active: '运行中',
    draft: '草稿',
    archived: '已归档',
    noSkills: '暂无绑定技能',
  },
  'zh-TW': {
    eyebrow: 'AI 員工',
    title: 'AI 員工',
    description: '建立、分配並協作具備專業領域認知的 AI 員工。',
    create: '建立員工',
    empty: '暫無 AI 員工',
    emptyDescription: '從職位模板建立第一個 AI 員工，並為其設定模型、技能與知識庫。',
    deploy: '從模板部署',
    active: '執行中',
    draft: '草稿',
    archived: '已封存',
    noSkills: '暫無綁定技能',
  },
  en: {
    eyebrow: 'AI workforce',
    title: 'AI workforce',
    description: 'Create, assign, and collaborate with AI workers that understand your domain.',
    create: 'Create worker',
    empty: 'No AI workers yet',
    emptyDescription:
      'Deploy your first worker from a role template, then configure its model, skills, and knowledge.',
    deploy: 'Deploy from template',
    active: 'Running',
    draft: 'Draft',
    archived: 'Archived',
    noSkills: 'No skills linked',
  },
};

export default function AgentListPage() {
  const { locale } = useLocale();
  const copy = COPY[locale];
  const [offset, setOffset] = useState(0);
  const {
    data: page,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['agents', offset],
    queryFn: () =>
      apiClient.get<ListPage<AgentSummary>>(`/agents?limit=${PAGE_SIZE}&offset=${offset}`),
    placeholderData: (previous) => previous,
  });
  const agents = page?.data;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={copy.eyebrow}
        title={copy.title}
        description={copy.description}
        actions={
          <Button asChild className="gap-1.5 text-xs font-semibold">
            <Link href="/dashboard/agents/new">
              <Plus className="h-3.5 w-3.5" /> {copy.create}
            </Link>
          </Button>
        }
      />

      {isLoading && <LoadingCards />}
      {isError && <ErrorState onRetry={() => void refetch()} />}

      {!isLoading && !isError && (!agents || agents.length === 0) && (
        <EmptyState
          icon={Bot}
          title={copy.empty}
          description={copy.emptyDescription}
          action={
            <Button asChild size="sm" variant="outline" className="text-xs">
              <Link href="/dashboard/agents/new">{copy.deploy}</Link>
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
                    className={`rounded-full border px-2 py-0.5 text-2xs font-bold ${
                      a.status === 'ACTIVE'
                        ? 'bg-success/5 border-success/15 text-success'
                        : 'bg-muted border-border text-muted-foreground'
                    }`}
                  >
                    {a.status === 'ACTIVE'
                      ? copy.active
                      : a.status === 'DRAFT'
                        ? copy.draft
                        : copy.archived}
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
                      className="rounded-md border border-border/50 bg-muted px-2 py-0.5 text-2xs font-medium text-muted-foreground"
                    >
                      {s.skillKey}
                    </span>
                  ))
                ) : (
                  <span className="text-2xs text-muted-foreground">{copy.noSkills}</span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
      {page && (
        <PaginationBar
          offset={page.offset}
          limit={page.limit}
          total={page.total}
          nextOffset={page.nextOffset}
          onChange={setOffset}
        />
      )}
    </div>
  );
}
