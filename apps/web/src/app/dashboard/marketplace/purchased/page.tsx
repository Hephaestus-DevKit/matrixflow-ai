'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

export default function PurchasedPage() {
  const { data } = useQuery({
    queryKey: ['purchased'],
    queryFn: () => apiClient.get<any[]>('/market/purchased'),
  });
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">已购买模板</h1>
      {data?.map((p: any) => (
        <div
          key={p.id}
          className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3"
        >
          <span>{p.item?.name}</span>
          <span className="text-sm text-muted-foreground">${p.priceUsd}</span>
        </div>
      ))}
    </div>
  );
}
