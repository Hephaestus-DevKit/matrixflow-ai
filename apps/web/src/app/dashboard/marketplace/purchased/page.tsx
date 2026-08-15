'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { MarketplacePurchaseSummary } from '@matrixflow/shared';
import { useLocale, type Locale } from '@/lib/i18n';

const COPY: Record<Locale, string> = {
  'zh-CN': '已购买模板',
  'zh-TW': '已購買模板',
  en: 'Purchased templates',
};

export default function PurchasedPage() {
  const { locale } = useLocale();
  const { data } = useQuery({
    queryKey: ['purchased'],
    queryFn: () => apiClient.get<MarketplacePurchaseSummary[]>('/market/purchased'),
  });
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">{COPY[locale]}</h1>
      {data?.map((purchase) => (
        <div
          key={purchase.id}
          className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3"
        >
          <span>{purchase.item?.name}</span>
          <span className="text-sm text-muted-foreground">${purchase.priceUsd}</span>
        </div>
      ))}
    </div>
  );
}
