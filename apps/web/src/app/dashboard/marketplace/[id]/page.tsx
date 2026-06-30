'use client';

import { useQuery, useMutation } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';

export default function ItemDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { data: item } = useQuery({ queryKey: ['item', id], queryFn: () => apiClient.get<any>(`/market/items/${id}`), enabled: !!id });
  const buy = useMutation({ mutationFn: () => apiClient.post(`/market/items/${id}/purchase`, {}), onSuccess: () => { alert('购买成功！'); router.push('/dashboard/marketplace/purchased'); } });

  if (!item) return <p className="text-muted-foreground">加载中...</p>;
  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">{item.name}</h1>
      <p className="text-muted-foreground">{item.description}</p>
      <div className="flex items-center gap-4">
        <span className="text-2xl font-bold text-primary">${item.priceUsd}</span>
        <Button onClick={() => buy.mutate()} disabled={buy.isPending}>{buy.isPending ? '处理中...' : '立即购买'}</Button>
      </div>
      <div><h2 className="mb-2 text-sm font-semibold">评论</h2>{item.reviews?.map((r: any) => <div key={r.id} className="rounded border border-border p-3 text-sm"><span>{'⭐'.repeat(r.rating)}</span><p>{r.comment}</p></div>)}</div>
    </div>
  );
}
