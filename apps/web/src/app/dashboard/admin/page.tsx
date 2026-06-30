'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';

export default function AdminPage() {
  const { data: revenue } = useQuery({ queryKey: ['admin-revenue'], queryFn: () => apiClient.get<any>('/admin/revenue') });
  const { data: models } = useQuery({ queryKey: ['admin-models'], queryFn: () => apiClient.get<any[]>('/admin/models') });
  const { data: pending } = useQuery({ queryKey: ['admin-pending'], queryFn: () => apiClient.get<any[]>('/admin/items/pending') });

  return (
    <div className="space-y-8">
      <h1 className="text-xl font-bold">管理后台</h1>

      {/* Revenue stats */}
      <div className="grid gap-4 sm:grid-cols-4">
        {revenue && (
          <>
            <div className="rounded-xl border border-border bg-card p-5">
              <p className="text-sm text-muted-foreground">本月 AI 调用</p>
              <p className="mt-2 text-2xl font-bold">{revenue.aiCalls?.toLocaleString() ?? 0}</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-5">
              <p className="text-sm text-muted-foreground">AI 成本</p>
              <p className="mt-2 text-2xl font-bold text-destructive">${revenue.aiCostUsd?.toFixed(2) ?? '0.00'}</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-5">
              <p className="text-sm text-muted-foreground">市场收入</p>
              <p className="mt-2 text-2xl font-bold text-success">${revenue.marketplaceRevenueUsd?.toFixed(2) ?? '0.00'}</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-5">
              <p className="text-sm text-muted-foreground">Token 输入/输出</p>
              <p className="mt-2 text-2xl font-bold">{((revenue.tokenIn ?? 0) / 1000).toFixed(0)}K / {((revenue.tokenOut ?? 0) / 1000).toFixed(0)}K</p>
            </div>
          </>
        )}
      </div>

      {/* Model Monitor */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground">模型调用监控（今日）</h2>
        <div className="rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/50">
              <tr><th className="px-4 py-2 text-left">Provider</th><th className="px-4 py-2 text-left">Model</th><th className="px-4 py-2 text-right">调用次数</th><th className="px-4 py-2 text-right">Token 输入</th><th className="px-4 py-2 text-right">Token 输出</th><th className="px-4 py-2 text-right">成本</th></tr>
            </thead>
            <tbody>
              {models?.map((m: any) => (
                <tr key={m.provider + m.model} className="border-b border-border last:border-0">
                  <td className="px-4 py-2">{m.provider}</td>
                  <td className="px-4 py-2 font-mono text-xs">{m.model}</td>
                  <td className="px-4 py-2 text-right">{m._count}</td>
                  <td className="px-4 py-2 text-right">{m._sum?.inputTokens?.toLocaleString() ?? 0}</td>
                  <td className="px-4 py-2 text-right">{m._sum?.outputTokens?.toLocaleString() ?? 0}</td>
                  <td className="px-4 py-2 text-right">${(m._sum?.costUsd ?? 0).toFixed(4)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pending Items */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground">待审核模板（{pending?.length ?? 0}）</h2>
        <div className="space-y-2">
          {pending?.map((item: any) => (
            <div key={item.id} className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3 text-sm">
              <span>{item.name}</span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => apiClient.post(`/admin/items/${item.id}/approve`, {})}>批准</Button>
                <Button size="sm" variant="ghost" className="text-destructive" onClick={() => apiClient.post(`/admin/items/${item.id}/reject`, { reason: '不符合标准' })}>拒绝</Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
