'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Ban,
  CheckCircle2,
  Clock3,
  ListChecks,
  Loader2,
  RefreshCw,
  RotateCcw,
  Search,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { apiClient, type ListPage } from '@/lib/api-client';
import { errorMessage } from '@/lib/errors';
import { useLocale, type Locale } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { EmptyState, ErrorState, LoadingCards } from '@/components/ui/states';
import { PageHeader } from '@/components/ui/page';
import { ListToolbar } from '@/components/ui/list-toolbar';
import { PaginationBar } from '@/components/ui/pagination';
import { Select } from '@/components/ui/select';

type JobStatus = 'QUEUED' | 'RUNNING' | 'RETRY_WAIT' | 'SUCCEEDED' | 'FAILED' | 'CANCELED';
type BackgroundJob = {
  id: string;
  type: string;
  status: JobStatus;
  attempts: number;
  maxAttempts: number;
  runAfter?: string;
  startedAt?: string | null;
  completedAt?: string | null;
  cancelRequested?: boolean;
};

const JOB_PAGE_SIZE = 25;

const COPY: Record<
  Locale,
  {
    eyebrow: string;
    title: string;
    description: string;
    refresh: string;
    empty: string;
    emptyDescription: string;
    cancel: string;
    canceling: string;
    canceled: string;
    failed: string;
    filterPlaceholder: string;
    allStatuses: string;
    noMatch: string;
    clearFilter: string;
    results: (visible: number, total: number) => string;
    attempt: (current: number, maximum: number) => string;
    status: Record<JobStatus, string>;
  }
> = {
  'zh-CN': {
    eyebrow: '运行可靠性',
    title: '任务中心',
    description: '集中查看异步 AI、知识索引和工作流任务；运行中的状态会自动刷新。',
    refresh: '刷新',
    empty: '暂无后台任务',
    emptyDescription: '选择异步运行后，任务状态会显示在这里。',
    cancel: '取消任务',
    canceling: '正在取消',
    canceled: '已请求取消任务',
    failed: '任务操作失败',
    filterPlaceholder: '按任务类型或 ID 筛选…',
    allStatuses: '全部状态',
    noMatch: '没有匹配的任务',
    clearFilter: '清除筛选',
    results: (visible, total) => `显示 ${visible} / ${total} 项`,
    attempt: (current, maximum) => `尝试 ${current}/${maximum}`,
    status: {
      QUEUED: '等待中',
      RUNNING: '运行中',
      RETRY_WAIT: '等待重试',
      SUCCEEDED: '已完成',
      FAILED: '失败',
      CANCELED: '已取消',
    },
  },
  'zh-TW': {
    eyebrow: '執行可靠性',
    title: '任務中心',
    description: '集中檢視非同步 AI、知識索引與工作流程任務；執行中的狀態會自動更新。',
    refresh: '重新整理',
    empty: '暫無背景任務',
    emptyDescription: '選擇非同步執行後，任務狀態會顯示在這裡。',
    cancel: '取消任務',
    canceling: '正在取消',
    canceled: '已請求取消任務',
    failed: '任務操作失敗',
    filterPlaceholder: '依任務類型或 ID 篩選…',
    allStatuses: '全部狀態',
    noMatch: '沒有相符的任務',
    clearFilter: '清除篩選',
    results: (visible, total) => `顯示 ${visible} / ${total} 項`,
    attempt: (current, maximum) => `嘗試 ${current}/${maximum}`,
    status: {
      QUEUED: '等待中',
      RUNNING: '執行中',
      RETRY_WAIT: '等待重試',
      SUCCEEDED: '已完成',
      FAILED: '失敗',
      CANCELED: '已取消',
    },
  },
  en: {
    eyebrow: 'Runtime reliability',
    title: 'Task center',
    description:
      'Track asynchronous AI, knowledge indexing, and workflow jobs. Active tasks refresh automatically.',
    refresh: 'Refresh',
    empty: 'No background tasks',
    emptyDescription: 'Tasks appear here after you choose an asynchronous run.',
    cancel: 'Cancel task',
    canceling: 'Canceling',
    canceled: 'Cancellation requested',
    failed: 'Task action failed',
    filterPlaceholder: 'Filter by task type or ID…',
    allStatuses: 'All statuses',
    noMatch: 'No matching tasks',
    clearFilter: 'Clear filters',
    results: (visible, total) => `Showing ${visible} of ${total}`,
    attempt: (current, maximum) => `Attempt ${current}/${maximum}`,
    status: {
      QUEUED: 'Queued',
      RUNNING: 'Running',
      RETRY_WAIT: 'Retry scheduled',
      SUCCEEDED: 'Completed',
      FAILED: 'Failed',
      CANCELED: 'Canceled',
    },
  },
};

const STATUS_ICON = {
  QUEUED: Clock3,
  RUNNING: Loader2,
  RETRY_WAIT: RotateCcw,
  SUCCEEDED: CheckCircle2,
  FAILED: XCircle,
  CANCELED: Ban,
} satisfies Record<JobStatus, typeof Clock3>;

function formatTime(value: string | null | undefined, locale: Locale) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

export default function JobsPage() {
  const { locale } = useLocale();
  const copy = COPY[locale];
  const [canceling, setCanceling] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [status, setStatus] = useState<'ALL' | JobStatus>('ALL');
  const [offset, setOffset] = useState(0);
  const query = useQuery({
    queryKey: ['jobs', offset],
    queryFn: () =>
      apiClient.get<ListPage<BackgroundJob>>(`/jobs?limit=${JOB_PAGE_SIZE}&offset=${offset}`),
    placeholderData: (previous) => previous,
    refetchInterval: (state) =>
      state.state.data?.data.some((job) => ['QUEUED', 'RUNNING', 'RETRY_WAIT'].includes(job.status))
        ? 5_000
        : false,
  });
  const active = useMemo(
    () =>
      query.data?.data.filter((job) => ['QUEUED', 'RUNNING', 'RETRY_WAIT'].includes(job.status))
        .length ?? 0,
    [query.data],
  );
  const filteredJobs = useMemo(() => {
    const needle = filter.trim().toLocaleLowerCase(locale);
    return (query.data?.data ?? []).filter(
      (job) =>
        (status === 'ALL' || job.status === status) &&
        (!needle || `${job.type} ${job.id}`.toLocaleLowerCase(locale).includes(needle)),
    );
  }, [filter, locale, query.data, status]);

  async function cancel(jobId: string) {
    setCanceling(jobId);
    try {
      await apiClient.post(`/jobs/${jobId}/cancel`, { reason: 'user_requested' });
      toast.success(copy.canceled);
      await query.refetch();
    } catch (error) {
      toast.error(errorMessage(error, copy.failed, locale));
    } finally {
      setCanceling(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={copy.eyebrow}
        title={copy.title}
        description={copy.description}
        actions={
          <Button
            type="button"
            variant="outline"
            className="gap-2"
            onClick={() => void query.refetch()}
            disabled={query.isFetching}
          >
            <RefreshCw
              className={`h-4 w-4 ${query.isFetching ? 'animate-spin' : ''}`}
              aria-hidden="true"
            />
            {copy.refresh}
            {active > 0 && <span className="status-pill bg-primary/10 text-primary">{active}</span>}
          </Button>
        }
      />
      {query.isLoading && <LoadingCards count={3} />}
      {query.isError && <ErrorState onRetry={() => void query.refetch()} />}
      {!query.isLoading && !query.isError && !query.data?.data.length && (
        <EmptyState icon={ListChecks} title={copy.empty} description={copy.emptyDescription} />
      )}
      {!!query.data?.data.length && (
        <div className="space-y-3">
          <ListToolbar
            value={filter}
            onChange={setFilter}
            placeholder={copy.filterPlaceholder}
            resultLabel={copy.results(filteredJobs.length, query.data.data.length)}
          >
            <Select
              value={status}
              onChange={(event) => setStatus(event.target.value as 'ALL' | JobStatus)}
              aria-label={copy.allStatuses}
              className="w-auto min-w-36"
            >
              <option value="ALL">{copy.allStatuses}</option>
              {(Object.keys(copy.status) as JobStatus[]).map((value) => (
                <option key={value} value={value}>
                  {copy.status[value]}
                </option>
              ))}
            </Select>
          </ListToolbar>
          {filteredJobs.length === 0 && (
            <EmptyState
              icon={Search}
              title={copy.noMatch}
              action={
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setFilter('');
                    setStatus('ALL');
                  }}
                >
                  {copy.clearFilter}
                </Button>
              }
            />
          )}
          {filteredJobs.map((job) => {
            const Icon = STATUS_ICON[job.status];
            const activeJob = ['QUEUED', 'RUNNING', 'RETRY_WAIT'].includes(job.status);
            return (
              <article
                key={job.id}
                className="surface-card flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon
                      className={`h-4.5 w-4.5 ${job.status === 'RUNNING' ? 'animate-spin' : ''}`}
                      aria-hidden="true"
                    />
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate text-sm font-bold text-foreground">{job.type}</h2>
                      <span className="status-pill">{copy.status[job.status]}</span>
                    </div>
                    <p className="mt-1 truncate font-mono text-2xs text-muted-foreground">
                      {job.id}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {copy.attempt(job.attempts, job.maxAttempts)} ·{' '}
                      {formatTime(job.completedAt ?? job.startedAt ?? job.runAfter, locale)}
                    </p>
                  </div>
                </div>
                {activeJob && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5 sm:self-center"
                    disabled={canceling === job.id || job.cancelRequested}
                    onClick={() => void cancel(job.id)}
                  >
                    {canceling === job.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <Ban className="h-4 w-4" aria-hidden="true" />
                    )}
                    {canceling === job.id ? copy.canceling : copy.cancel}
                  </Button>
                )}
              </article>
            );
          })}
        </div>
      )}
      {query.data && (
        <PaginationBar
          offset={query.data.offset}
          limit={query.data.limit}
          total={query.data.total}
          nextOffset={query.data.nextOffset}
          busy={query.isFetching}
          onChange={(nextOffset) => {
            setOffset(nextOffset);
            setFilter('');
            setStatus('ALL');
          }}
        />
      )}
    </div>
  );
}
