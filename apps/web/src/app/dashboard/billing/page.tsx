'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

export default function BillingPage() {
  const { data: plans } = useQuery({ queryKey: ['plans'], queryFn: () => apiClient.get<any[]>('/billing/plans') });
  const { data: current } = useQuery({ queryKey: ['sub'], queryFn: () => apiClient.get<any>('/billing/current') });
  const { data: usage } = useQuery({ queryKey: ['usage'], queryFn: () => apiClient.get<any>('/billing/usage') });

  return (
    <div className="space-y-8">
      <h1 className="text-xl font-bold">计费与套餐</h1>
      {current && <div className="rounded-lg border border-success/30 bg-success/5 p-4 text-sm">当前套餐：<b>{current.plan?.name}</b> · {current.status}</div>}
      <div><h2 className="mb-3 text-sm font-semibold text-muted-foreground">本月用量</h2><pre className="rounded-lg bg-muted/50 p-4 text-sm">{JSON.stringify(usage, null, 2)}</pre></div>
      <div className="grid gap-4 sm:grid-cols-3">
        {plans?.map((p: any) => (
          <div key={p.id} className="rounded-xl border border-border bg-card p-5">
            <h3 className="font-semibold">{p.name}</h3><p className="mt-1 text-2xl font-bold">${p.priceMonthlyUsd}<span className="text-sm font-normal text-muted-foreground">/月</span></p>
            <ul className="mt-3 space-y-1 text-sm text-muted-foreground"><li>{p.seats} 席位</li><li>{p.aiCallsPerMonth} AI 调用</li><li>{p.workflowLimit} 工作流</li></ul>
            <button className="mt-4 w-full rounded-md bg-primary py-2 text-sm text-primary-foreground" onClick={() => apiClient.post('/billing/subscribe', { planId: p.id })}>升级到 {p.name}</button>
          </div>
        ))}
      </div>
    </div>
  );
}
