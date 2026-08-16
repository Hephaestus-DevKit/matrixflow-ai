'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, type FormEvent } from 'react';
import { Check, CreditCard, Sparkles } from 'lucide-react';
import type {
  BillingPlan,
  BillingRequest,
  SubscriptionSummary,
  UsageSummary,
} from '@matrixflow/shared';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ErrorState, LoadingCards } from '@/components/ui/states';
import { PageHeader, SectionHeading } from '@/components/ui/page';
import { useLocale, type Locale } from '@/lib/i18n';
import { errorMessage } from '@/lib/errors';
import { toast } from 'sonner';
import { BillingHistoryCard } from '@/components/billing-history-card';

const COPY: Record<
  Locale,
  {
    eyebrow: string;
    title: string;
    description: string;
    currentPlan: string;
    trial: string;
    calls: string;
    tokens: string;
    planning: string;
    planningDescription: string;
    current: string;
    seat: string;
    callsPerMonth: string;
    workflows: string;
    active: string;
    waitlist: string;
    unsubscribed: string;
    month: string;
    requestUpgrade: string;
    checkout: string;
    checkoutLoading: string;
    checkoutFailed: string;
    requesting: string;
    requested: string;
    requestAlready: string;
    requestFailed: string;
    requestDescription: string;
    requestFormTitle: string;
    requestFormDescription: string;
    requestedSeats: string;
    requestedSeatsHint: string;
    note: string;
    notePlaceholder: string;
    noteOptional: string;
    cancel: string;
    submitRequest: string;
    seatValidation: string;
    requestHistory: string;
    status: string;
    requestedOn: string;
    statuses: Record<BillingRequest['status'], string>;
  }
> = {
  'zh-CN': {
    eyebrow: '套餐与用量',
    title: '计费与套餐',
    description: '查看免费测试额度与候补套餐；付费结账当前不会产生任何扣款。',
    currentPlan: '当前套餐',
    trial: '测试中',
    calls: 'AI 调用',
    tokens: 'Token',
    planning: '套餐规划',
    planningDescription: 'Free 已开放；Pro 与 Team 为候补方案，支付服务接入后再开放。',
    current: '当前套餐',
    seat: '个席位',
    callsPerMonth: '次 AI 调用',
    workflows: '个工作流',
    active: '正在使用',
    waitlist: '候补未开放',
    unsubscribed: '尚未订阅',
    month: ' / 月',
    requestUpgrade: '申请升级',
    checkout: '前往结账',
    checkoutLoading: '打开结账…',
    checkoutFailed: '结账暂时不可用，请稍后重试',
    requesting: '提交中…',
    requested: '已提交申请',
    requestAlready: '升级申请已在处理中',
    requestFailed: '升级申请提交失败，请稍后重试',
    requestDescription: '提交后我们会根据团队规模联系你，支付接入后再完成正式开通。',
    requestFormTitle: '告诉我们你的升级计划',
    requestFormDescription: '席位数量和备注会随申请发送给团队管理员，便于更快确认方案。',
    requestedSeats: '预计席位数',
    requestedSeatsHint: '1–500 个席位',
    note: '补充说明',
    notePlaceholder: '例如：预计下月扩展到 12 人，需要优先处理内容工作流。',
    noteOptional: '可选',
    cancel: '取消',
    submitRequest: '提交升级申请',
    seatValidation: '请输入 1 到 500 之间的整数。',
    requestHistory: '申请记录',
    status: '状态',
    requestedOn: '提交于',
    statuses: { PENDING: '处理中', CONTACTED: '已联系', CONVERTED: '已开通', CANCELED: '已取消' },
  },
  'zh-TW': {
    eyebrow: '方案與用量',
    title: '計費與方案',
    description: '查看免費測試額度與候補方案；付費結帳目前不會產生任何扣款。',
    currentPlan: '目前方案',
    trial: '測試中',
    calls: 'AI 呼叫',
    tokens: 'Token',
    planning: '方案規劃',
    planningDescription: 'Free 已開放；Pro 與 Team 為候補方案，支付服務接入後再開放。',
    current: '目前方案',
    seat: '個席位',
    callsPerMonth: '次 AI 呼叫',
    workflows: '個工作流',
    active: '使用中',
    waitlist: '候補未開放',
    unsubscribed: '尚未訂閱',
    month: ' / 月',
    requestUpgrade: '申請升級',
    checkout: '前往結帳',
    checkoutLoading: '開啟結帳…',
    checkoutFailed: '結帳暫時不可用，請稍後再試',
    requesting: '提交中…',
    requested: '已提交申請',
    requestAlready: '升級申請正在處理中',
    requestFailed: '升級申請提交失敗，請稍後再試',
    requestDescription: '提交後我們會依團隊規模聯絡你，支付服務接入後再完成正式開通。',
    requestFormTitle: '告訴我們你的升級計畫',
    requestFormDescription: '席位數量與備註會隨申請傳送給團隊管理員，方便更快確認方案。',
    requestedSeats: '預計席位數',
    requestedSeatsHint: '1–500 個席位',
    note: '補充說明',
    notePlaceholder: '例如：預計下月擴展到 12 人，需要優先處理內容工作流。',
    noteOptional: '選填',
    cancel: '取消',
    submitRequest: '提交升級申請',
    seatValidation: '請輸入 1 到 500 之間的整數。',
    requestHistory: '申請記錄',
    status: '狀態',
    requestedOn: '提交於',
    statuses: { PENDING: '處理中', CONTACTED: '已聯絡', CONVERTED: '已開通', CANCELED: '已取消' },
  },
  en: {
    eyebrow: 'Plans & usage',
    title: 'Plans & billing',
    description:
      'Review the free preview quota and waitlist plans. Checkout is not available and creates no charge.',
    currentPlan: 'Current plan',
    trial: 'Preview',
    calls: 'AI calls',
    tokens: 'Tokens',
    planning: 'Plan roadmap',
    planningDescription:
      'Free is available; Pro and Team are waitlist plans until payments are ready.',
    current: 'Current plan',
    seat: 'seats',
    callsPerMonth: 'AI calls',
    workflows: 'workflows',
    active: 'In use',
    waitlist: 'Waitlist only',
    unsubscribed: 'Not subscribed',
    month: ' / month',
    requestUpgrade: 'Request upgrade',
    checkout: 'Go to checkout',
    checkoutLoading: 'Opening checkout…',
    checkoutFailed: 'Checkout is temporarily unavailable. Try again shortly.',
    requesting: 'Submitting…',
    requested: 'Request submitted',
    requestAlready: 'An upgrade request is already in progress',
    requestFailed: 'Could not submit the upgrade request. Try again shortly.',
    requestDescription:
      'We will follow up based on your team size and activate the plan after checkout is ready.',
    requestFormTitle: 'Tell us about your upgrade plan',
    requestFormDescription:
      'Seat count and notes are shared with the team administrator so we can confirm the right plan faster.',
    requestedSeats: 'Estimated seats',
    requestedSeatsHint: '1–500 seats',
    note: 'Additional context',
    notePlaceholder:
      'For example: We expect 12 users next month and need priority content workflows.',
    noteOptional: 'Optional',
    cancel: 'Cancel',
    submitRequest: 'Submit upgrade request',
    seatValidation: 'Enter a whole number between 1 and 500.',
    requestHistory: 'Request history',
    status: 'Status',
    requestedOn: 'Requested on',
    statuses: {
      PENDING: 'In progress',
      CONTACTED: 'Contacted',
      CONVERTED: 'Activated',
      CANCELED: 'Canceled',
    },
  },
};

export default function BillingPage() {
  const { locale } = useLocale();
  const copy = COPY[locale];
  const queryClient = useQueryClient();
  const [intentPlan, setIntentPlan] = useState<string | null>(null);
  const [requestPlan, setRequestPlan] = useState<'pro' | 'team' | null>(null);
  const [requestedSeats, setRequestedSeats] = useState('');
  const [requestNote, setRequestNote] = useState('');
  const [seatError, setSeatError] = useState(false);
  useEffect(() => {
    const plan = new URLSearchParams(window.location.search).get('plan');
    setIntentPlan(plan);
    if (plan === 'pro' || plan === 'team') {
      setRequestPlan(plan);
      setRequestedSeats(plan === 'pro' ? '5' : '20');
    }
  }, []);
  const plans = useQuery({
    queryKey: ['plans'],
    queryFn: () => apiClient.get<BillingPlan[]>('/billing/plans'),
  });
  const current = useQuery({
    queryKey: ['sub'],
    queryFn: () => apiClient.get<SubscriptionSummary | null>('/billing/current'),
  });
  const usage = useQuery({
    queryKey: ['usage'],
    queryFn: () => apiClient.get<UsageSummary>('/billing/usage'),
  });
  const requests = useQuery({
    queryKey: ['billing-requests'],
    queryFn: () => apiClient.get<BillingRequest[]>('/billing/requests'),
  });
  const billingConfig = useQuery({
    queryKey: ['billing-config'],
    queryFn: () => apiClient.get<{ checkout: boolean }>('/billing/config'),
  });
  const requestMutation = useMutation({
    mutationFn: (input: { requestedPlan: 'pro' | 'team'; requestedSeats: number; note: string }) =>
      apiClient.post<{ request: BillingRequest; created: boolean }>('/billing/requests', {
        requestedPlan: input.requestedPlan,
        requestedSeats: input.requestedSeats,
        note: input.note,
      }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['billing-requests'] });
      toast.success(result.created ? copy.requested : copy.requestAlready);
      setRequestPlan(null);
      setRequestNote('');
    },
    onError: (error: unknown) => toast.error(errorMessage(error, copy.requestFailed)),
  });
  const checkoutMutation = useMutation({
    mutationFn: (input: { planId: 'pro' | 'team'; seats: number }) =>
      apiClient.post<{ checkoutUrl: string }>('/billing/checkout', input),
    onSuccess: (result) => {
      window.location.assign(result.checkoutUrl);
    },
    onError: (error: unknown) => toast.error(errorMessage(error, copy.checkoutFailed)),
  });
  const queries = [plans, current, usage];
  const isLoading = queries.some((query) => query.isLoading);
  const isError = queries.some((query) => query.isError);
  const submitUpgradeRequest = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!requestPlan) return;
    const seats = Number(requestedSeats);
    if (!Number.isInteger(seats) || seats < 1 || seats > 500) {
      setSeatError(true);
      return;
    }
    setSeatError(false);
    requestMutation.mutate({
      requestedPlan: requestPlan,
      requestedSeats: seats,
      note: requestNote.trim(),
    });
  };
  const openRequestForm = (plan: 'pro' | 'team') => {
    setRequestPlan(plan);
    setRequestedSeats(plan === 'pro' ? '5' : '20');
    setRequestNote('');
    setSeatError(false);
  };
  const formatRequestedDate = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(date);
  };

  return (
    <div className="space-y-8">
      <PageHeader eyebrow={copy.eyebrow} title={copy.title} description={copy.description} />
      {isLoading ? (
        <LoadingCards count={3} />
      ) : isError ? (
        <ErrorState onRetry={() => void Promise.all(queries.map((query) => query.refetch()))} />
      ) : (
        <>
          <section className="surface-card flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-success/10 text-success">
                <CreditCard className="h-5 w-5" />
              </span>
              <div>
                <p className="text-xs text-muted-foreground">{copy.currentPlan}</p>
                <p className="mt-0.5 text-sm font-bold">
                  {current.data?.plan?.name ?? copy.unsubscribed}
                  {current.data && (
                    <span className="ml-2 text-xs font-medium text-success">{copy.trial}</span>
                  )}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              <span className="rounded-full bg-muted px-3 py-1.5">
                {copy.calls} {usage.data?.ai_call?.toLocaleString() ?? 0}
              </span>
              <span className="rounded-full bg-muted px-3 py-1.5">
                {copy.tokens}{' '}
                {(
                  (usage.data?.token_input ?? 0) + (usage.data?.token_output ?? 0)
                ).toLocaleString()}
              </span>
            </div>
          </section>
          <section className="space-y-4">
            <SectionHeading title={copy.planning} description={copy.planningDescription} />
            <div className="grid gap-4 lg:grid-cols-3">
              {plans.data?.map((plan) => {
                const selected =
                  current.data?.plan?.id === plan.id ||
                  (plan.id === 'free' && current.data?.id === 'free-preview');
                const isRequestable = plan.id === 'pro' || plan.id === 'team';
                const requestPending = requests.data?.some(
                  (request) => request.requestedPlan === plan.id && request.status === 'PENDING',
                );
                const checkoutReady = isRequestable && billingConfig.data?.checkout === true;
                const isIntent = intentPlan === plan.id;
                return (
                  <article
                    key={plan.id}
                    className={`surface-card relative flex flex-col p-6 ${selected || isIntent ? 'border-primary/40 ring-1 ring-primary/20' : ''}`}
                  >
                    {selected && (
                      <span className="absolute right-4 top-4 rounded-full bg-primary/10 px-2.5 py-1 text-[0.625rem] font-bold text-primary">
                        {copy.current}
                      </span>
                    )}
                    <Sparkles className="h-5 w-5 text-primary" />
                    <h2 className="mt-4 text-lg font-bold">{plan.name}</h2>
                    <p className="mt-2 text-3xl font-bold tracking-tight">
                      ${plan.priceMonthlyUsd}
                      <span className="text-sm font-normal text-muted-foreground">
                        {copy.month}
                      </span>
                    </p>
                    <ul className="mt-6 flex-1 space-y-3 text-sm text-muted-foreground">
                      {[
                        `${plan.seats} ${copy.seat}`,
                        `${plan.aiCallsPerMonth.toLocaleString()} ${copy.callsPerMonth}`,
                        `${plan.workflowLimit} ${copy.workflows}`,
                      ].map((feature) => (
                        <li key={feature} className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-success" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                    {isRequestable && (
                      <p className="mt-5 text-xs leading-5 text-muted-foreground">
                        {copy.requestDescription}
                      </p>
                    )}
                    <Button
                      className="mt-6 w-full"
                      variant={selected ? 'outline' : 'default'}
                      disabled={
                        selected ||
                        !isRequestable ||
                        (checkoutReady
                          ? checkoutMutation.isPending
                          : requestPending || requestMutation.isPending)
                      }
                      onClick={() => {
                        if (plan.id !== 'pro' && plan.id !== 'team') return;
                        if (checkoutReady) {
                          checkoutMutation.mutate({ planId: plan.id, seats: plan.seats });
                        } else openRequestForm(plan.id);
                      }}
                    >
                      {selected
                        ? copy.active
                        : checkoutReady
                          ? checkoutMutation.isPending &&
                            checkoutMutation.variables?.planId === plan.id
                            ? copy.checkoutLoading
                            : copy.checkout
                          : requestPending
                            ? copy.requested
                            : requestMutation.isPending &&
                                requestMutation.variables?.requestedPlan === plan.id
                              ? copy.requesting
                              : isRequestable
                                ? copy.requestUpgrade
                                : copy.waitlist}
                    </Button>
                  </article>
                );
              })}
            </div>
            {requestPlan && (
              <form
                className="surface-card border-primary/25 bg-primary/[0.035] p-5 sm:p-6"
                onSubmit={submitUpgradeRequest}
              >
                <div className="flex flex-col gap-1">
                  <h3 className="text-base font-bold">
                    {copy.requestFormTitle} · {requestPlan === 'pro' ? 'Pro' : 'Team'}
                  </h3>
                  <p className="text-sm leading-6 text-muted-foreground">
                    {copy.requestFormDescription}
                  </p>
                </div>
                <div className="mt-5 grid gap-4 sm:grid-cols-[minmax(0,13rem)_1fr]">
                  <div className="space-y-2">
                    <Label htmlFor="requested-seats">{copy.requestedSeats}</Label>
                    <Input
                      id="requested-seats"
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={500}
                      value={requestedSeats}
                      aria-invalid={seatError}
                      onChange={(event) => {
                        setRequestedSeats(event.target.value);
                        if (seatError) setSeatError(false);
                      }}
                    />
                    <p className="text-xs text-muted-foreground">{copy.requestedSeatsHint}</p>
                    {seatError && (
                      <p className="text-xs font-medium text-destructive">{copy.seatValidation}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="upgrade-note">
                      {copy.note}{' '}
                      <span className="font-normal text-muted-foreground">
                        ({copy.noteOptional})
                      </span>
                    </Label>
                    <Textarea
                      id="upgrade-note"
                      value={requestNote}
                      maxLength={1000}
                      placeholder={copy.notePlaceholder}
                      onChange={(event) => setRequestNote(event.target.value)}
                    />
                    <p className="text-right text-xs text-muted-foreground">
                      {requestNote.length}/1000
                    </p>
                  </div>
                </div>
                <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <Button type="button" variant="ghost" onClick={() => setRequestPlan(null)}>
                    {copy.cancel}
                  </Button>
                  <Button type="submit" disabled={requestMutation.isPending}>
                    {requestMutation.isPending ? copy.requesting : copy.submitRequest}
                  </Button>
                </div>
              </form>
            )}
            {requests.data && requests.data.length > 0 && (
              <section className="surface-card overflow-hidden">
                <div className="border-b border-border/60 px-5 py-4">
                  <h3 className="text-sm font-bold">{copy.requestHistory}</h3>
                </div>
                <div className="divide-y divide-border/60">
                  {requests.data.map((request) => (
                    <div
                      key={request.id}
                      className="flex flex-col gap-2 px-5 py-4 text-sm sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="rounded-lg bg-muted px-2.5 py-1 text-xs font-bold uppercase">
                          {request.requestedPlan}
                        </span>
                        <span className="text-muted-foreground">
                          {request.requestedSeats} {copy.seat}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span>
                          {copy.status}:{' '}
                          <strong className="font-semibold text-foreground">
                            {copy.statuses[request.status]}
                          </strong>
                        </span>
                        <span>
                          {copy.requestedOn} {formatRequestedDate(request.createdAt)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
            <BillingHistoryCard />
          </section>
        </>
      )}
    </div>
  );
}
