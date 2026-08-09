'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import Link from 'next/link';
import { Users, TrendingUp, UserCheck, ArrowRight } from 'lucide-react';
import type { CustomerSummary, LeadSummary } from '@matrixflow/shared';
import { EmptyState, ErrorState, PageLoader } from '@/components/ui/states';
import { PageHeader } from '@/components/ui/page';

export default function CrmPage() {
  const customersQuery = useQuery({
    queryKey: ['customers'],
    queryFn: () => apiClient.get<CustomerSummary[]>('/crm/customers'),
  });
  const leadsQuery = useQuery({
    queryKey: ['leads'],
    queryFn: () => apiClient.get<LeadSummary[]>('/crm/leads'),
  });

  const customers = customersQuery.data;
  const leads = leadsQuery.data;
  const isLoading = customersQuery.isLoading || leadsQuery.isLoading;
  const isError = customersQuery.isError || leadsQuery.isError;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Customer intelligence"
        title="智能 CRM"
        description="追踪多渠道买家意图，并识别高价值销售线索。"
      />

      {isLoading && <PageLoader label="正在加载客户数据" />}
      {isError && (
        <ErrorState
          onRetry={() => void Promise.all([customersQuery.refetch(), leadsQuery.refetch()])}
        />
      )}

      {!isLoading && !isError && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Customers */}
          <div className="space-y-3">
            <h2 className="text-sm font-bold text-muted-foreground flex items-center gap-1.5 uppercase tracking-wider">
              <Users className="h-4 w-4 text-primary" /> 买家客户库
            </h2>
            {(!customers || customers.length === 0) && (
              <EmptyState icon={Users} title="暂无买家客户数据" />
            )}
            <div className="space-y-2">
              {customers?.map((c) => (
                <Link
                  key={c.id}
                  href={`/dashboard/crm/${c.id}`}
                  className="interactive-card group flex items-center justify-between rounded-xl px-4 py-3 text-xs font-semibold"
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
            {(!leads || leads.length === 0) && (
              <EmptyState icon={TrendingUp} title="暂无智能识别的销售线索" />
            )}
            <div className="space-y-2">
              {leads?.map((l) => (
                <div
                  key={l.id}
                  className="surface-card flex items-center justify-between rounded-xl px-4 py-3 text-xs font-semibold"
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
      )}
    </div>
  );
}
