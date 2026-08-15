'use client';

import { useQuery, useMutation } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import type { MarketplaceItemSummary } from '@matrixflow/shared';
import { useLocale, type Locale } from '@/lib/i18n';

const COPY: Record<
  Locale,
  { success: string; loading: string; processing: string; buy: string; reviews: string }
> = {
  'zh-CN': {
    success: '购买成功！',
    loading: '加载中…',
    processing: '处理中…',
    buy: '立即购买',
    reviews: '评论',
  },
  'zh-TW': {
    success: '購買成功！',
    loading: '載入中…',
    processing: '處理中…',
    buy: '立即購買',
    reviews: '評論',
  },
  en: {
    success: 'Purchase complete.',
    loading: 'Loading…',
    processing: 'Processing…',
    buy: 'Purchase now',
    reviews: 'Reviews',
  },
};

export default function ItemDetailPage() {
  const { locale } = useLocale();
  const copy = COPY[locale];
  const { id } = useParams();
  const router = useRouter();
  const { data: item } = useQuery({
    queryKey: ['item', id],
    queryFn: () => apiClient.get<MarketplaceItemSummary>(`/market/items/${id}`),
    enabled: !!id,
  });
  const buy = useMutation({
    mutationFn: () => apiClient.post(`/market/items/${id}/purchase`, {}),
    onSuccess: () => {
      alert(copy.success);
      router.push('/dashboard/marketplace/purchased');
    },
  });

  if (!item) return <p className="text-muted-foreground">{copy.loading}</p>;
  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">{item.name}</h1>
      <p className="text-muted-foreground">{item.description}</p>
      <div className="flex items-center gap-4">
        <span className="text-2xl font-bold text-primary">${item.priceUsd}</span>
        <Button onClick={() => buy.mutate()} disabled={buy.isPending}>
          {buy.isPending ? copy.processing : copy.buy}
        </Button>
      </div>
      <div>
        <h2 className="mb-2 text-sm font-semibold">{copy.reviews}</h2>
        {item.reviews?.map((review) => (
          <div key={review.id} className="rounded border border-border p-3 text-sm">
            <span>{'⭐'.repeat(review.rating)}</span>
            <p>{review.comment}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
