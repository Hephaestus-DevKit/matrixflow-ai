'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Check, CreditCard, Sparkles } from 'lucide-react';
import type {
  BillingPlan,
  BillingRequest,
  SubscriptionSummary,
  UsageSummary,
} from '@matrixflow/shared';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { ErrorState, LoadingCards } from '@/components/ui/states';
import { PageHeader, SectionHeading } from '@/components/ui/page';
import { useLocale, type Locale } from '@/lib/i18n';
import { errorMessage } from '@/lib/errors';
import { toast } from 'sonner';

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
    requesting: string;
    requested: string;
    requestAlready: string;
    requestFailed: string;
    requestDescription: string;
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
    requesting: '提交中…',
    requested: '已提交申请',
    requestAlready: '升级申请已在处理中',
    requestFailed: '升级申请提交失败，请稍后重试',
    requestDescription: '提交后我们会根据团队规模联系你，支付接入后再完成正式开通。',
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
    requesting: '提交中…',
    requested: '已提交申請',
    requestAlready: '升級申請正在處理中',
    requestFailed: '升級申請提交失敗，請稍後再試',
    requestDescription: '提交後我們會依團隊規模聯絡你，支付服務接入後再完成正式開通。',
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
    requesting: 'Submitting…',
    requested: 'Request submitted',
    requestAlready: 'An upgrade request is already in progress',
    requestFailed: 'Could not submit the upgrade request. Try again shortly.',
    requestDescription:
      'We will follow up based on your team size and activate the plan after checkout is ready.',
  },
};

export default function BillingPage() {
  const { locale } = useLocale();
  const copy = COPY[locale];
  const queryClient = useQueryClient();
  const [intentPlan, setIntentPlan] = useState<string | null>(null);
  useEffect(() => {
    setIntentPlan(new URLSearchParams(window.location.search).get('plan'));
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
  const requestMutation = useMutation({
    mutationFn: (requestedPlan: 'pro' | 'team') =>
      apiClient.post<{ request: BillingRequest; created: boolean }>('/billing/requests', {
        requestedPlan,
        requestedSeats: requestedPlan === 'pro' ? 5 : 20,
      }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['billing-requests'] });
      toast.success(result.created ? copy.requested : copy.requestAlready);
    },
    onError: (error: unknown) => toast.error(errorMessage(error, copy.requestFailed)),
  });
  const queries = [plans, current, usage];
  const isLoading = queries.some((query) => query.isLoading);
  const isError = queries.some((query) => query.isError);

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
                        selected || !isRequestable || requestPending || requestMutation.isPending
                      }
                      onClick={() => {
                        if (plan.id === 'pro' || plan.id === 'team')
                          requestMutation.mutate(plan.id);
                      }}
                    >
                      {selected
                        ? copy.active
                        : requestPending
                          ? copy.requested
                          : requestMutation.isPending && requestMutation.variables === plan.id
                            ? copy.requesting
                            : isRequestable
                              ? copy.requestUpgrade
                              : copy.waitlist}
                    </Button>
                  </article>
                );
              })}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
