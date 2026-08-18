'use client';

import { useQuery } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { Workflow } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import type { WorkflowDetail, WorkflowRunSummary } from '@matrixflow/shared';
import { useLocale, type Locale } from '@/lib/i18n';
import { PageHeader } from '@/components/ui/page';
import { EmptyState, LoadingCards } from '@/components/ui/states';

const COPY: Record<Locale, { title: string; description: string; empty: string }> = {
  'zh-CN': {
    title: '运行日志',
    description: '查看每次执行的状态、版本与耗时。',
    empty: '暂无运行记录',
  },
  'zh-TW': {
    title: '執行日誌',
    description: '查看每次執行的狀態、版本與耗時。',
    empty: '暫無執行記錄',
  },
  en: {
    title: 'Run log',
    description: 'Review status, version, and duration for every run.',
    empty: 'No runs yet',
  },
};

export default function WorkflowRunsPage() {
  const { locale } = useLocale();
  const copy = COPY[locale];
  const { id } = useParams();
  const { data: logs, isLoading } = useQuery({
    queryKey: ['wf-logs', id],
    queryFn: () => apiClient.get<WorkflowRunSummary[]>(`/workflows/${id}/logs`),
    enabled: !!id,
  });
  const { data: wf } = useQuery({
    queryKey: ['wf', id],
    queryFn: () => apiClient.get<WorkflowDetail>(`/workflows/${id}`),
    enabled: !!id,
  });
  return (
    <div className="space-y-6">
      <PageHeader
        title={`${copy.title}${wf?.name ? ` — ${wf.name}` : ''}`}
        description={copy.description}
      />
      {isLoading && <LoadingCards count={3} />}
      {!isLoading && logs?.length === 0 && <EmptyState icon={Workflow} title={copy.empty} />}
      <div className="space-y-2">
        {logs?.map((run) => (
          <div key={run.id} className="surface-card px-4 py-3.5 text-sm">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs text-muted-foreground">{run.id.slice(0, 8)}</span>
              <span
                className={
                  run.status === 'SUCCESS'
                    ? 'text-success'
                    : run.status === 'FAILED'
                      ? 'text-destructive'
                      : 'text-muted-foreground'
                }
              >
                {run.status}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              v{run.version} · {run.triggerType} · {run.durationMs ? `${run.durationMs}ms` : '—'}
              {run.error && <span className="ml-2 text-destructive">{run.error}</span>}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
