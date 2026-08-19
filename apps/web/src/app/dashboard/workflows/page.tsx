'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { apiClient, type ListPage } from '@/lib/api-client';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { GitFork, Plus, ArrowRight } from 'lucide-react';
import type { WorkflowSummary } from '@matrixflow/shared';
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
    first: string;
    runs: string;
    version: string;
  }
> = {
  'zh-CN': {
    eyebrow: '自动化',
    title: '工作流',
    description: '通过可视化画布编排和运行自动化 AI 流水线。',
    create: '新建工作流',
    empty: '暂无工作流自动化',
    emptyDescription: '使用流程画布将 AI、逻辑判断与第三方 API 连接为自动化生产线。',
    first: '创建第一个工作流',
    runs: '次历史运行',
    version: '版本',
  },
  'zh-TW': {
    eyebrow: '自動化',
    title: '工作流',
    description: '透過視覺化畫布編排並執行自動化 AI 流程。',
    create: '建立工作流',
    empty: '暫無工作流自動化',
    emptyDescription: '使用流程畫布將 AI、邏輯判斷與第三方 API 連接為自動化生產線。',
    first: '建立第一個工作流',
    runs: '次歷史執行',
    version: '版本',
  },
  en: {
    eyebrow: 'Automation',
    title: 'Workflows',
    description: 'Compose and run automated AI pipelines on a visual canvas.',
    create: 'Create workflow',
    empty: 'No workflow automations',
    emptyDescription: 'Connect AI, logic, and third-party APIs into an automated production line.',
    first: 'Create your first workflow',
    runs: 'historical runs',
    version: 'Version',
  },
};

export default function WorkflowListPage() {
  const { locale } = useLocale();
  const copy = COPY[locale];
  const [offset, setOffset] = useState(0);
  const {
    data: page,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['wfs', offset],
    queryFn: () =>
      apiClient.get<ListPage<WorkflowSummary>>(`/workflows?limit=${PAGE_SIZE}&offset=${offset}`),
    placeholderData: (previous) => previous,
  });
  const wfs = page?.data;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={copy.eyebrow}
        title={copy.title}
        description={copy.description}
        actions={
          <Button asChild className="gap-1.5 text-xs font-semibold">
            <Link href="/dashboard/workflows/new">
              <Plus className="h-3.5 w-3.5" /> {copy.create}
            </Link>
          </Button>
        }
      />

      {isLoading && <LoadingCards count={2} />}
      {isError && <ErrorState onRetry={() => void refetch()} />}

      {!isLoading && !isError && wfs && wfs.length === 0 && (
        <EmptyState
          icon={GitFork}
          title={copy.empty}
          description={copy.emptyDescription}
          action={
            <Button asChild size="sm" variant="outline" className="text-xs">
              <Link href="/dashboard/workflows/new">{copy.first}</Link>
            </Button>
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
                    {w._count?.runs ?? 0} {copy.runs} · {copy.version} v{w.currentVersion}
                  </p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 transition-[opacity,transform] group-hover:translate-x-1 group-hover:opacity-100 group-focus-visible:opacity-100" />
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
