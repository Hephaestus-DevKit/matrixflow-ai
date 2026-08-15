'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { BarChart3, Cpu } from 'lucide-react';
import type { UsageSummary } from '@matrixflow/shared';
import { EmptyState, ErrorState, LoadingCards } from '@/components/ui/states';
import { PageHeader } from '@/components/ui/page';
import { useLocale, type Locale } from '@/lib/i18n';

const COPY: Record<
  Locale,
  {
    eyebrow: string;
    title: string;
    description: string;
    emptyTitle: string;
    emptyDescription: string;
    metrics: Record<string, string>;
  }
> = {
  'zh-CN': {
    eyebrow: '用量分析',
    title: '数据看板',
    description: '监控本月资源开销、AI 调用与流量配额利用情况。',
    emptyTitle: '暂无资源使用指标',
    emptyDescription: '产生 AI 调用或工作流运行后，用量数据会显示在这里。',
    metrics: { ai_call: 'AI 调用', token_input: '输入 Token', token_output: '输出 Token' },
  },
  'zh-TW': {
    eyebrow: '用量分析',
    title: '資料看板',
    description: '監控本月資源開銷、AI 呼叫與流量額度使用情況。',
    emptyTitle: '暫無資源使用指標',
    emptyDescription: '產生 AI 呼叫或工作流執行後，用量資料會顯示在這裡。',
    metrics: { ai_call: 'AI 呼叫', token_input: '輸入 Token', token_output: '輸出 Token' },
  },
  en: {
    eyebrow: 'Usage analytics',
    title: 'Analytics',
    description: 'Monitor this month’s resource spend, AI calls, and quota utilization.',
    emptyTitle: 'No usage metrics yet',
    emptyDescription: 'Usage appears here after an AI call or workflow run completes.',
    metrics: { ai_call: 'AI calls', token_input: 'Input tokens', token_output: 'Output tokens' },
  },
};

export default function AnalyticsPage() {
  const { locale } = useLocale();
  const copy = COPY[locale];
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
      <PageHeader eyebrow={copy.eyebrow} title={copy.title} description={copy.description} />

      {isLoading && <LoadingCards count={4} />}
      {isError && <ErrorState onRetry={() => void refetch()} />}

      {!isLoading && !isError && (!usage || Object.keys(usage).length === 0) && (
        <EmptyState icon={BarChart3} title={copy.emptyTitle} description={copy.emptyDescription} />
      )}

      {usage && Object.keys(usage).length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Object.entries(usage).map(([k, v]) => (
            <div key={k} className="surface-card p-5">
              <div className="flex items-center justify-between mb-3 text-muted-foreground">
                <span className="text-xs font-semibold">{copy.metrics[k] ?? k}</span>
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
