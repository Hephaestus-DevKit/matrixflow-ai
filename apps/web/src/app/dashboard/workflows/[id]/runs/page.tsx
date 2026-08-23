'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { Workflow } from 'lucide-react';
import { apiClient, type ListPage } from '@/lib/api-client';
import type { WorkflowDetail, WorkflowRunSummary } from '@matrixflow/shared';
import { useLocale, type Locale } from '@/lib/i18n';
import { PageHeader } from '@/components/ui/page';
import { PaginationBar } from '@/components/ui/pagination';
import { EmptyState, ErrorState, LoadingCards } from '@/components/ui/states';

const RUN_PAGE_SIZE = 25;

const COPY: Record<
  Locale,
  {
    eyebrow: string;
    title: string;
    description: string;
    empty: string;
    status: Record<string, string>;
  }
> = {
  'zh-CN': {
    eyebrow: '执行历史',
    title: '运行日志',
    description: '查看每次执行的状态、版本与耗时。',
    empty: '暂无运行记录',
    status: { SUCCESS: '成功', FAILED: '失败', RUNNING: '运行中', PENDING: '等待中' },
  },
  'zh-TW': {
    eyebrow: '執行歷史',
    title: '執行日誌',
    description: '查看每次執行的狀態、版本與耗時。',
    empty: '暫無執行記錄',
    status: { SUCCESS: '成功', FAILED: '失敗', RUNNING: '執行中', PENDING: '等待中' },
  },
  en: {
    eyebrow: 'Execution history',
    title: 'Run log',
    description: 'Review status, version, and duration for every run.',
    empty: 'No runs yet',
    status: { SUCCESS: 'Successful', FAILED: 'Failed', RUNNING: 'Running', PENDING: 'Pending' },
  },
};

export default function WorkflowRunsPage() {
  const { locale } = useLocale();
  const copy = COPY[locale];
  const { id } = useParams();
  const [offset, setOffset] = useState(0);
  const logsQuery = useQuery({
    queryKey: ['wf-logs', id, offset],
    queryFn: () =>
      apiClient.get<ListPage<WorkflowRunSummary>>(
        `/workflows/${id}/logs?limit=${RUN_PAGE_SIZE}&offset=${offset}`,
      ),
    enabled: !!id,
    placeholderData: (previous) => previous,
  });
  const { data: wf } = useQuery({
    queryKey: ['wf', id],
    queryFn: () => apiClient.get<WorkflowDetail>(`/workflows/${id}`),
    enabled: !!id,
  });
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={copy.eyebrow}
        title={`${copy.title}${wf?.name ? ` — ${wf.name}` : ''}`}
        description={copy.description}
      />
      {logsQuery.isLoading && <LoadingCards count={3} />}
      {logsQuery.isError && <ErrorState onRetry={() => void logsQuery.refetch()} />}
      {!logsQuery.isLoading && !logsQuery.isError && logsQuery.data?.data.length === 0 && (
        <EmptyState icon={Workflow} title={copy.empty} />
      )}
      <div className="space-y-2">
        {logsQuery.data?.data.map((run) => (
          <div key={run.id} className="surface-card px-4 py-3.5 text-sm">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs text-muted-foreground">{run.id.slice(0, 8)}</span>
              <span
                className={`status-pill ${
                  run.status === 'SUCCESS'
                    ? 'bg-success/10 text-success'
                    : run.status === 'FAILED'
                      ? 'bg-destructive/10 text-destructive'
                      : 'bg-primary/10 text-primary'
                }`}
              >
                {copy.status[run.status] ?? run.status}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              v{run.version} · {run.triggerType} · {run.durationMs ? `${run.durationMs}ms` : '—'}
              {run.error && <span className="ml-2 text-destructive">{run.error}</span>}
            </p>
          </div>
        ))}
      </div>
      {logsQuery.data && (
        <PaginationBar
          offset={logsQuery.data.offset}
          limit={logsQuery.data.limit}
          total={logsQuery.data.total}
          nextOffset={logsQuery.data.nextOffset}
          busy={logsQuery.isFetching}
          onChange={setOffset}
        />
      )}
    </div>
  );
}
