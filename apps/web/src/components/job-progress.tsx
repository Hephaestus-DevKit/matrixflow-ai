'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { errorMessage } from '@/lib/errors';
import { useLocale } from '@/lib/i18n';
import { type BackgroundJob, isActiveJob, jobResultText } from '@/lib/jobs';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/states';
import type { RagAnswer } from '@matrixflow/shared';
import { ResultSources } from '@/components/ui/result-sources';
import { ResultText } from '@/components/ui/result-text';

export function JobProgress({
  jobId,
  onSettled,
  showResult = true,
}: {
  jobId: string;
  onSettled?: (job: BackgroundJob) => void;
  showResult?: boolean;
}) {
  const { locale } = useLocale();
  const settled = useRef<string | null>(null);
  const callback = useRef(onSettled);
  callback.current = onSettled;
  const query = useQuery({
    queryKey: ['job', jobId],
    queryFn: ({ signal }) => apiClient.get<BackgroundJob>(`/jobs/${jobId}`, { signal }),
    refetchInterval: (state) => (isActiveJob(state.state.data) ? 2_000 : false),
  });
  const cancelMutation = useMutation({
    mutationFn: () => apiClient.post(`/jobs/${jobId}/cancel`, { reason: 'user_requested' }),
    onSuccess: () => {
      void query.refetch();
    },
    onError: (error: unknown) => toast.error(errorMessage(error)),
  });
  const cancelLabel =
    locale === 'en' ? 'Cancel task' : locale === 'zh-TW' ? '取消任務' : '取消任务';
  const cancelPending =
    locale === 'en'
      ? 'Cancellation requested. The current request may still finish.'
      : locale === 'zh-TW'
        ? '已請求取消，已送出的請求可能仍會完成。'
        : '已请求取消，已发出的请求可能仍会完成。';
  useEffect(() => {
    const job = query.data;
    if (job && !isActiveJob(job) && settled.current !== job.id) {
      settled.current = job.id;
      callback.current?.(job);
    }
  }, [query.data]);
  const copy = {
    'zh-CN': {
      active: '任务正在后台处理，可以离开此页面。',
      done: '任务已完成',
      failed: '任务失败。请返回来源检查输入后重新运行。',
      canceled: '任务已取消',
      view: '查看任务',
      source: '返回来源',
      partial: '部分内容生成失败，已完成的结果已保留。',
      retry: '刷新状态',
      statuses: {
        QUEUED: '等待中',
        RUNNING: '运行中',
        RETRY_WAIT: '等待重试',
        SUCCEEDED: '已完成',
        FAILED: '失败',
        CANCELED: '已取消',
      },
    },
    'zh-TW': {
      active: '任務正在背景處理，可以離開此頁面。',
      done: '任務已完成',
      failed: '任務失敗。請返回來源檢查輸入後重新執行。',
      canceled: '任務已取消',
      view: '檢視任務',
      source: '返回來源',
      partial: '部分內容產生失敗，已完成的結果已保留。',
      retry: '更新狀態',
      statuses: {
        QUEUED: '等待中',
        RUNNING: '執行中',
        RETRY_WAIT: '等待重試',
        SUCCEEDED: '已完成',
        FAILED: '失敗',
        CANCELED: '已取消',
      },
    },
    en: {
      active: 'Processing in the background. You can leave this page.',
      done: 'Task completed',
      failed: 'Task failed. Return to the source, check your input, and run again.',
      canceled: 'Task canceled',
      view: 'View task',
      source: 'Return to source',
      partial: 'Some content could not be generated. Completed results have been saved.',
      retry: 'Refresh status',
      statuses: {
        QUEUED: 'Queued',
        RUNNING: 'Running',
        RETRY_WAIT: 'Retry scheduled',
        SUCCEEDED: 'Completed',
        FAILED: 'Failed',
        CANCELED: 'Canceled',
      },
    },
  }[locale];
  if (query.isError)
    return (
      <ErrorState
        message={errorMessage(query.error, undefined, locale)}
        onRetry={() => void query.refetch()}
      />
    );
  const job = query.data;
  const active = !job || isActiveJob(job);
  const text = job ? jobResultText(job) : '';
  return (
    <section className="surface-card space-y-3 p-4">
      <div role="status" aria-live="polite" className="flex items-start gap-2 text-sm">
        {active && (
          <Loader2
            className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-primary"
            aria-hidden="true"
          />
        )}
        <div>
          <p className="font-semibold">{job ? copy.statuses[job.status] : copy.statuses.QUEUED}</p>
          <p className="mt-1 text-muted-foreground">
            {active
              ? copy.active
              : job?.status === 'FAILED'
                ? copy.failed
                : job?.status === 'CANCELED'
                  ? copy.canceled
                  : copy.done}
          </p>
          {job?.error && job.status === 'FAILED' && (
            <p className="mt-1 text-destructive">
              {errorMessage(
                typeof job.error === 'object' ? job.error : { code: 'BACKEND_ERROR' },
                undefined,
                locale,
              )}
            </p>
          )}
          {job?.status === 'SUCCEEDED' && Number(job.result?.failed) > 0 && (
            <p className="mt-1 text-warning">
              {copy.partial} ({String(job.result?.completed ?? 0)} /{' '}
              {Number(job.result?.completed ?? 0) + Number(job.result?.failed)})
            </p>
          )}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {job && isActiveJob(job) && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={cancelMutation.isPending || job.cancelRequested}
            onClick={() => cancelMutation.mutate()}
          >
            {cancelLabel}
          </Button>
        )}
        <Button type="button" variant="outline" size="sm" asChild>
          <Link href={`/dashboard/jobs/${jobId}`}>{copy.view}</Link>
        </Button>
        {job?.resourceHref?.startsWith('/dashboard/') && (
          <Button type="button" variant="ghost" size="sm" asChild>
            <Link href={job.resourceHref as Route}>{copy.source}</Link>
          </Button>
        )}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={query.isFetching}
          onClick={() => void query.refetch()}
        >
          {copy.retry}
        </Button>
      </div>
      {showResult && text && <ResultText text={text} filename={`matrixflow-${jobId}.txt`} />}
      {showResult && job?.type === 'knowledge.ask' && (
        <ResultSources citations={job.result?.citations as RagAnswer['citations'] | undefined} />
      )}
      {showResult && job?.type === 'agent.run' && (
        <ResultSources
          citations={(job.result?.output as { citations?: RagAnswer['citations'] })?.citations}
        />
      )}
    </section>
  );
}
