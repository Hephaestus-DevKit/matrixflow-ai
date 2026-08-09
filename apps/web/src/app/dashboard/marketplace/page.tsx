'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import Link from 'next/link';
import { Store, Bot, GitFork, FileText, Star } from 'lucide-react';
import type { MarketplaceItemSummary, Paginated } from '@matrixflow/shared';
import { EmptyState, ErrorState, LoadingCards } from '@/components/ui/states';
import { PageHeader } from '@/components/ui/page';

export default function MarketplacePage() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['market'],
    queryFn: () => apiClient.get<Paginated<MarketplaceItemSummary>>('/market/items?pageSize=24'),
  });
  const items = data?.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Template ecosystem"
        title="模板生态市场"
        description="部署行业专家创建的 AI 员工与自动化业务流方案。"
      />

      {isLoading && <LoadingCards />}
      {isError && <ErrorState onRetry={() => void refetch()} />}

      {!isLoading && !isError && items.length === 0 && (
        <EmptyState
          icon={Store}
          title="模板市场暂未开放"
          description="官方与生态开发者模板正在准备上架。"
        />
      )}

      {items.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((it) => {
            const Icon = it.type === 'agent' ? Bot : it.type === 'workflow' ? GitFork : FileText;
            const typeLabel =
              it.type === 'agent' ? 'AI 员工' : it.type === 'workflow' ? '工作流' : '文档模板';
            return (
              <Link
                key={it.id}
                href={`/dashboard/marketplace/${it.id}`}
                className="interactive-card group flex flex-col justify-between p-5"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/5 text-primary">
                      <Icon className="h-4.5 w-4.5" />
                    </div>
                    <span className="text-xs font-bold text-primary bg-primary/5 px-2 py-0.5 rounded-md">
                      ${it.priceUsd}
                    </span>
                  </div>
                  <h3 className="mt-4 font-bold text-foreground text-sm group-hover:text-primary transition-colors">
                    {it.name}
                  </h3>
                  <p className="text-2xs text-muted-foreground mt-0.5 font-medium">{typeLabel}</p>
                </div>
                <div className="mt-5 flex items-center justify-between border-t border-border/40 pt-3 text-[11px] text-muted-foreground">
                  <span>{it.installs} 次安装</span>
                  <span className="flex items-center gap-1 font-semibold text-amber-500">
                    <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
                    {it.ratingAvg.toFixed(1)}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
