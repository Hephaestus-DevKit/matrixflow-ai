'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { BarChart3, Cpu } from 'lucide-react';
import type { UsageSummary } from '@matrixflow/shared';
import { EmptyState, ErrorState, LoadingCards } from '@/components/ui/states';
import { PageHeader } from '@/components/ui/page';

const METRIC_LABELS: Record<string, string> = {
  ai_call: 'AI 调用',
  token_input: '输入 Token',
  token_output: '输出 Token',
};

export default function AnalyticsPage() {
  const {
    data: usage,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['usage'],
    queryFn: () => apiClient.get<UsageSummary>('/billing/usage'),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Usage analytics"
        title="数据看板"
        description="监控本月资源开销、AI 调用与流量配额利用情况。"
      />

      {isLoading && <LoadingCards count={4} />}
      {isError && <ErrorState onRetry={() => void refetch()} />}

      {!isLoading && !isError && (!usage || Object.keys(usage).length === 0) && (
        <EmptyState
          icon={BarChart3}
          title="暂无资源使用指标"
          description="产生 AI 调用或工作流运行后，用量数据会显示在这里。"
        />
      )}

      {usage && Object.keys(usage).length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Object.entries(usage).map(([k, v]) => (
            <div key={k} className="surface-card p-5">
              <div className="flex items-center justify-between mb-3 text-muted-foreground">
                <span className="text-xs font-semibold">{METRIC_LABELS[k] ?? k}</span>
                <Cpu className="h-4 w-4 text-primary" />
              </div>
              <p className="text-2xl font-bold tracking-tight text-foreground">
                {v.toLocaleString()}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
