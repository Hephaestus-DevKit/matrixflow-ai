'use client';

import { useQuery } from '@tanstack/react-query';
import { Check, CreditCard, Sparkles } from 'lucide-react';
import type { BillingPlan, SubscriptionSummary, UsageSummary } from '@matrixflow/shared';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { ErrorState, LoadingCards } from '@/components/ui/states';
import { PageHeader, SectionHeading } from '@/components/ui/page';

export default function BillingPage() {
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
      <PageHeader
        eyebrow="Plans & usage"
        title="计费与套餐"
        description="查看免费测试额度与候补套餐；付费结账当前不会产生任何扣款。"
      />
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
                <p className="text-xs text-muted-foreground">当前套餐</p>
                <p className="mt-0.5 text-sm font-bold">
                  {current.data?.plan?.name ?? '尚未订阅'}
                  {current.data && (
                    <span className="ml-2 text-xs font-medium text-success">测试中</span>
                  )}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              <span className="rounded-full bg-muted px-3 py-1.5">
                AI 调用 {usage.data?.ai_call?.toLocaleString() ?? 0}
              </span>
              <span className="rounded-full bg-muted px-3 py-1.5">
                Token{' '}
                {(
                  (usage.data?.token_input ?? 0) + (usage.data?.token_output ?? 0)
                ).toLocaleString()}
              </span>
            </div>
          </section>
          <section className="space-y-4">
            <SectionHeading
              title="套餐规划"
              description="Free 已开放；Pro 与 Team 为候补方案，支付服务接入后再开放。"
            />
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
                        当前套餐
                      </span>
                    )}
                    <Sparkles className="h-5 w-5 text-primary" />
                    <h2 className="mt-4 text-lg font-bold">{plan.name}</h2>
                    <p className="mt-2 text-3xl font-bold tracking-tight">
                      ${plan.priceMonthlyUsd}
                      <span className="text-sm font-normal text-muted-foreground"> / 月</span>
                    </p>
                    <ul className="mt-6 flex-1 space-y-3 text-sm text-muted-foreground">
                      {[
                        `${plan.seats} 个席位`,
                        `${plan.aiCallsPerMonth.toLocaleString()} 次 AI 调用`,
                        `${plan.workflowLimit} 个工作流`,
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
                      {selected ? '正在使用' : '候补未开放'}
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
