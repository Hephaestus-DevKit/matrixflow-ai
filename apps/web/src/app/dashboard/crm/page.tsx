'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import Link from 'next/link';
import { Users, TrendingUp, UserCheck, ArrowRight, Plus, X } from 'lucide-react';
import type { CustomerSummary, LeadSummary } from '@matrixflow/shared';
import { EmptyState, ErrorState, PageLoader } from '@/components/ui/states';
import { PageHeader } from '@/components/ui/page';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { errorMessage } from '@/lib/errors';
import { toast } from 'sonner';

export default function CrmPage() {
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
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
  const createCustomer = useMutation({
    mutationFn: () =>
      apiClient.post<CustomerSummary>('/crm/customers', {
        name: name.trim() || undefined,
        email: email.trim() || undefined,
      }),
    onSuccess: async () => {
      setName('');
      setEmail('');
      setCreating(false);
      await queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast.success('客户已创建');
    },
    onError: (error: unknown) => toast.error(errorMessage(error, '无法创建客户')),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="客户洞察"
        title="智能 CRM"
        description="先维护客户与内部对话；外部渠道连接器将在完成安全配置后开放。"
        actions={
          <Button size="sm" onClick={() => setCreating((value) => !value)}>
            {creating ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {creating ? '取消' : '新建客户'}
          </Button>
        }
      />

      {creating && (
        <form
          className="surface-card grid gap-4 p-5 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
          onSubmit={(event) => {
            event.preventDefault();
            createCustomer.mutate();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="customer-name">客户姓名</Label>
            <Input
              id="customer-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="例如 Alex"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="customer-email">客户邮箱</Label>
            <Input
              id="customer-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="alex@example.com"
            />
          </div>
          <Button
            type="submit"
            disabled={createCustomer.isPending || (!name.trim() && !email.trim())}
          >
            {createCustomer.isPending ? '创建中…' : '创建客户'}
          </Button>
        </form>
      )}

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
              <EmptyState
                icon={Users}
                title="暂无买家客户数据"
                description="新建第一个客户后，可在详情页维护内部对话与 AI 回复建议。"
                action={<Button onClick={() => setCreating(true)}>新建客户</Button>}
              />
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
