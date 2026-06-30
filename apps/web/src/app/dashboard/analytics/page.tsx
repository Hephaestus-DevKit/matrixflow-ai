'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { ShieldAlert, Cpu } from 'lucide-react';

export default function AnalyticsPage() {
  const { data: usage, isLoading } = useQuery({ queryKey: ['usage'], queryFn: () => apiClient.get<Record<string, any>>('/billing/usage') });
  
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="border-b border-border/40 pb-5">
        <h1 className="text-xl font-bold tracking-tight">数据看板</h1>
        <p className="text-xs text-muted-foreground mt-0.5">监控系统资源开销、API 调用频次与流量配额利用率</p>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center p-12 text-muted-foreground text-sm gap-2">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
          加载中...
        </div>
      )}

      {!isLoading && (!usage || Object.keys(usage).length === 0) && (
        <div className="rounded-xl border border-dashed border-border/60 bg-muted/10 p-12 text-center flex flex-col items-center justify-center text-xs text-muted-foreground">
          <ShieldAlert className="h-10 w-10 text-muted-foreground/60 mb-3 animate-pulse-slow" />
          暂无可用资源使用指标
        </div>
      )}

      {usage && Object.keys(usage).length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Object.entries(usage).map(([k, v]) => (
            <div key={k} className="rounded-xl border border-border/60 bg-card p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3 text-muted-foreground">
                <span className="text-xs font-semibold uppercase tracking-wider">{k}</span>
                <Cpu className="h-4 w-4 text-primary" />
              </div>
              <p className="text-2xl font-bold tracking-tight text-foreground">{String(v)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}