'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import Link from 'next/link';
import { Store, Bot, GitFork, FileText, Star } from 'lucide-react';
import type { MarketplaceItemSummary, Paginated } from '@matrixflow/shared';

export default function MarketplacePage() {
  const { data, isLoading } = useQuery({
    queryKey: ['market'],
    queryFn: () => apiClient.get<Paginated<MarketplaceItemSummary>>('/market/items?pageSize=24'),
  });
  const items = data?.data ?? [];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="border-b border-border/40 pb-5">
        <h1 className="text-xl font-bold tracking-tight">模板生态市场</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          一键部署行业专家的 AI 员工人设与自动化业务流方案
        </p>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center p-12 text-muted-foreground text-sm gap-2">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
          加载中...
        </div>
      )}

      {!isLoading && items.length === 0 && (
        <div className="rounded-xl border border-dashed border-border/60 bg-muted/10 p-12 text-center flex flex-col items-center justify-center">
          <Store className="h-10 w-10 text-muted-foreground/60 mb-3 animate-pulse-slow" />
          <p className="text-sm font-semibold text-foreground">模板市场暂未开放</p>
          <p className="mt-1 text-xs text-muted-foreground max-w-[280px]">
            官方与生态开发者模板正在上架准备中，敬请期待。
          </p>
        </div>
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
                className="group rounded-xl border border-border/60 bg-card p-5 transition-all duration-300 hover:border-primary/30 hover:shadow-sm flex flex-col justify-between"
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
