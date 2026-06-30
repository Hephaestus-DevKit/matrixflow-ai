'use client';

import { useQuery } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { apiClient } from '@/lib/api-client';

export default function WorkflowRunsPage() {
  const { id } = useParams();
  const { data: logs } = useQuery({
    queryKey: ['wf-logs', id],
    queryFn: () => apiClient.get<any[]>(`/workflows/${id}/logs`),
    enabled: !!id,
  });
  const { data: wf } = useQuery({
    queryKey: ['wf', id],
    queryFn: () => apiClient.get<any>(`/workflows/${id}`),
    enabled: !!id,
  });
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">运行日志 — {wf?.name ?? ''}</h1>
      {logs?.length === 0 && (
        <div className="rounded-xl border border-dashed p-12 text-center text-muted-foreground">
          <p className="text-lg">🔗</p>
          <p className="mt-2">暂无运行记录</p>
        </div>
      )}
      <div className="space-y-2">
        {logs?.map((r: any) => (
          <div key={r.id} className="rounded-lg border border-border bg-card px-4 py-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs text-muted-foreground">{r.id.slice(0, 8)}</span>
              <span className={r.status === 'SUCCESS' ? 'text-success' : r.status === 'FAILED' ? 'text-destructive' : 'text-muted-foreground'}>
                {r.status}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              v{r.version} · {r.triggerType} · {r.durationMs ? `${r.durationMs}ms` : '—'}
              {r.error && <span className="ml-2 text-destructive">{r.error}</span>}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
