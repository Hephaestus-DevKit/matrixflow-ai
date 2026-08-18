'use client';

import { useQuery } from '@tanstack/react-query';
import { ShoppingBag } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import type { MarketplacePurchaseSummary } from '@matrixflow/shared';
import { useLocale, type Locale } from '@/lib/i18n';
import { PageHeader } from '@/components/ui/page';
import { EmptyState, LoadingCards } from '@/components/ui/states';

const COPY: Record<Locale, { title: string; description: string; empty: string }> = {
  'zh-CN': {
    title: '已购买模板',
    description: '集中查看团队已经获得授权的能力模板。',
    empty: '暂未购买模板',
  },
  'zh-TW': {
    title: '已購買模板',
    description: '集中查看團隊已獲得授權的能力範本。',
    empty: '暫未購買範本',
  },
  en: {
    title: 'Purchased templates',
    description: 'Review the capability templates already licensed to your team.',
    empty: 'No purchased templates yet',
  },
};

export default function PurchasedPage() {
  const { locale } = useLocale();
  const copy = COPY[locale];
  const { data, isLoading } = useQuery({
    queryKey: ['purchased'],
    queryFn: () => apiClient.get<MarketplacePurchaseSummary[]>('/market/purchased'),
  });
  return (
    <div className="space-y-6">
      <PageHeader title={copy.title} description={copy.description} />
      {isLoading && <LoadingCards count={2} />}
      {!isLoading && data?.length === 0 && <EmptyState icon={ShoppingBag} title={copy.empty} />}
      {data?.map((purchase) => (
        <div
          key={purchase.id}
          className="surface-card flex items-center justify-between gap-4 px-4 py-3.5"
        >
          <span className="min-w-0 truncate text-sm font-semibold">{purchase.item?.name}</span>
          <span className="shrink-0 text-sm font-semibold text-muted-foreground">
            ${purchase.priceUsd}
          </span>
        </div>
      ))}
    </div>
  );
}
