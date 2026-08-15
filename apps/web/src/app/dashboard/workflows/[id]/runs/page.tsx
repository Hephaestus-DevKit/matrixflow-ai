'use client';

import { useQuery } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import type { WorkflowDetail, WorkflowRunSummary } from '@matrixflow/shared';
import { useLocale, type Locale } from '@/lib/i18n';

const COPY: Record<Locale, { title: string; empty: string }> = {
  'zh-CN': { title: '运行日志', empty: '暂无运行记录' },
  'zh-TW': { title: '執行日誌', empty: '暫無執行記錄' },
  en: { title: 'Run log', empty: 'No runs yet' },
};

export default function WorkflowRunsPage() {
  const { locale } = useLocale();
  const copy = COPY[locale];
  const { id } = useParams();
  const { data: logs } = useQuery({
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
      <h1 className="text-xl font-bold">
        {copy.title} — {wf?.name ?? ''}
      </h1>
      {logs?.length === 0 && (
        <div className="rounded-xl border border-dashed p-12 text-center text-muted-foreground">
          <p className="text-lg">🔗</p>
          <p className="mt-2">{copy.empty}</p>
        </div>
      )}
      <div className="space-y-2">
        {logs?.map((run) => (
          <div key={run.id} className="rounded-lg border border-border bg-card px-4 py-3 text-sm">
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
