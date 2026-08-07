'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { MarketplacePurchaseSummary } from '@matrixflow/shared';

export default function PurchasedPage() {
  const { data } = useQuery({
    queryKey: ['purchased'],
    queryFn: () => apiClient.get<MarketplacePurchaseSummary[]>('/market/purchased'),
  });
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">已购买模板</h1>
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
