'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import Link from 'next/link';
import { Users, TrendingUp, UserCheck, ArrowRight } from 'lucide-react';
import type { CustomerSummary, LeadSummary } from '@matrixflow/shared';

export default function CrmPage() {
  const { data: customers, isLoading: isCustLoading } = useQuery({
    queryKey: ['customers'],
    queryFn: () => apiClient.get<CustomerSummary[]>('/crm/customers'),
  });
  const { data: leads, isLoading: isLeadsLoading } = useQuery({
    queryKey: ['leads'],
    queryFn: () => apiClient.get<LeadSummary[]>('/crm/leads'),
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="border-b border-border/40 pb-5">
        <h1 className="text-xl font-bold tracking-tight">智能 CRM</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          多渠道潜在买家意图追踪与高意向销售线索自动匹配
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Customers */}
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-muted-foreground flex items-center gap-1.5 uppercase tracking-wider">
            <Users className="h-4 w-4 text-primary" /> 买家客户库
          </h2>
          {isCustLoading && <p className="text-xs text-muted-foreground">加载中...</p>}
          {!isCustLoading && (!customers || customers.length === 0) && (
            <div className="rounded-xl border border-dashed border-border/60 bg-muted/10 p-8 text-center text-xs text-muted-foreground">
              暂无买家客户数据
            </div>
          )}
          <div className="space-y-2">
            {customers?.map((c) => (
              <Link
                key={c.id}
                href={`/dashboard/crm/${c.id}`}
                className="group flex items-center justify-between rounded-lg border border-border/60 bg-card px-4 py-3 text-xs font-semibold hover:border-primary/30 transition-all hover:shadow-sm"
              >
                <div className="flex items-center gap-2">
                  <UserCheck className="h-3.5 w-3.5 text-primary" />
                  <span>{c.name ?? c.email}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground font-medium group-hover:text-primary transition-colors">
                  <span>{c.stage}</span>
                  <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Sales Leads */}
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-muted-foreground flex items-center gap-1.5 uppercase tracking-wider">
            <TrendingUp className="h-4 w-4 text-success" /> 智能意向线索
          </h2>
          {isLeadsLoading && <p className="text-xs text-muted-foreground">加载中...</p>}
          {!isLeadsLoading && (!leads || leads.length === 0) && (
            <div className="rounded-xl border border-dashed border-border/60 bg-muted/10 p-8 text-center text-xs text-muted-foreground">
              暂无智能识别的销售线索
            </div>
          )}
          <div className="space-y-2">
            {leads?.map((l) => (
              <div
                key={l.id}
                className="flex items-center justify-between rounded-lg border border-border/60 bg-card px-4 py-3 text-xs font-semibold"
              >
                <span className="text-foreground">
                  {l.customer?.name ?? l.customer?.email ?? '匿名线索'}
                </span>
                <span className="rounded-full bg-success/10 px-2 py-0.5 text-success text-[10px] font-bold">
                  意向分 {l.score}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
