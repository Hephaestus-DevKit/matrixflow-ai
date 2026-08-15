'use client';

import { useQuery } from '@tanstack/react-query';
import { Check, CreditCard, Sparkles } from 'lucide-react';
import type { BillingPlan, SubscriptionSummary, UsageSummary } from '@matrixflow/shared';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { ErrorState, LoadingCards } from '@/components/ui/states';
import { PageHeader, SectionHeading } from '@/components/ui/page';
import { useLocale, type Locale } from '@/lib/i18n';

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
  },
};

export default function BillingPage() {
  const { locale } = useLocale();
  const copy = COPY[locale];
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
                const selected = current.data?.plan?.id === plan.id;
                return (
                  <article
                    key={plan.id}
                    className={`surface-card relative flex flex-col p-6 ${selected ? 'border-primary/40 ring-1 ring-primary/20' : ''}`}
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
                    <Button
                      className="mt-6 w-full"
                      variant={selected ? 'outline' : 'default'}
                      disabled
                    >
                      {selected ? copy.active : copy.waitlist}
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
