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
import { useLocale, type Locale } from '@/lib/i18n';

const COPY: Record<
  Locale,
  {
    eyebrow: string;
    title: string;
    description: string;
    cancel: string;
    createCustomer: string;
    customerName: string;
    customerEmail: string;
    creating: string;
    loading: string;
    buyerDb: string;
    noCustomers: string;
    noCustomersDescription: string;
    leads: string;
    noLeads: string;
    anonymous: string;
    intent: string;
    inviteError: string;
    customerCreated: string;
  }
> = {
  'zh-CN': {
    eyebrow: '客户洞察',
    title: '智能 CRM',
    description: '先维护客户与内部对话；外部渠道连接器将在完成安全配置后开放。',
    cancel: '取消',
    createCustomer: '新建客户',
    customerName: '客户姓名',
    customerEmail: '客户邮箱',
    creating: '创建中…',
    loading: '正在加载客户数据',
    buyerDb: '买家客户库',
    noCustomers: '暂无买家客户数据',
    noCustomersDescription: '新建第一个客户后，可在详情页维护内部对话与 AI 回复建议。',
    leads: '智能意向线索',
    noLeads: '暂无智能识别的销售线索',
    anonymous: '匿名线索',
    intent: '意向分',
    inviteError: '无法创建客户',
    customerCreated: '客户已创建',
  },
  'zh-TW': {
    eyebrow: '客戶洞察',
    title: '智慧 CRM',
    description: '先維護客戶與內部對話；外部渠道連接器將在完成安全設定後開放。',
    cancel: '取消',
    createCustomer: '建立客戶',
    customerName: '客戶姓名',
    customerEmail: '客戶電子郵件',
    creating: '建立中…',
    loading: '正在載入客戶資料',
    buyerDb: '買家客戶庫',
    noCustomers: '暫無買家客戶資料',
    noCustomersDescription: '建立第一個客戶後，可在詳情頁維護內部對話與 AI 回覆建議。',
    leads: '智慧意向線索',
    noLeads: '暫無智慧識別的銷售線索',
    anonymous: '匿名線索',
    intent: '意向分',
    inviteError: '無法建立客戶',
    customerCreated: '客戶已建立',
  },
  en: {
    eyebrow: 'Customer insights',
    title: 'Smart CRM',
    description:
      'Maintain customers and internal conversations first; external connectors open after secure configuration.',
    cancel: 'Cancel',
    createCustomer: 'New customer',
    customerName: 'Customer name',
    customerEmail: 'Customer email',
    creating: 'Creating…',
    loading: 'Loading customer data',
    buyerDb: 'Buyer customer base',
    noCustomers: 'No customer data yet',
    noCustomersDescription:
      'Create a customer to maintain internal conversations and AI reply suggestions.',
    leads: 'Intent leads',
    noLeads: 'No sales leads identified yet',
    anonymous: 'Anonymous lead',
    intent: 'Intent',
    inviteError: 'Could not create customer',
    customerCreated: 'Customer created',
  },
};

export default function CrmPage() {
  const { locale } = useLocale();
  const copy = COPY[locale];
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
      toast.success(copy.customerCreated);
    },
    onError: (error: unknown) => toast.error(errorMessage(error, copy.inviteError)),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={copy.eyebrow}
        title={copy.title}
        description={copy.description}
        actions={
          <Button size="sm" onClick={() => setCreating((value) => !value)}>
            {creating ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {creating ? copy.cancel : copy.createCustomer}
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
            <Label htmlFor="customer-name">{copy.customerName}</Label>
            <Input
              id="customer-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="例如 Alex"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="customer-email">{copy.customerEmail}</Label>
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
            {createCustomer.isPending ? copy.creating : copy.createCustomer}
          </Button>
        </form>
      )}

      {isLoading && <PageLoader label={copy.loading} />}
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
              <Users className="h-4 w-4 text-primary" /> {copy.buyerDb}
            </h2>
            {(!customers || customers.length === 0) && (
              <EmptyState
                icon={Users}
                title={copy.noCustomers}
                description={copy.noCustomersDescription}
                action={<Button onClick={() => setCreating(true)}>{copy.createCustomer}</Button>}
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
              <TrendingUp className="h-4 w-4 text-success" /> {copy.leads}
            </h2>
            {(!leads || leads.length === 0) && (
              <EmptyState icon={TrendingUp} title={copy.noLeads} />
            )}
            <div className="space-y-2">
              {leads?.map((l) => (
                <div
                  key={l.id}
                  className="surface-card flex items-center justify-between rounded-xl px-4 py-3 text-xs font-semibold"
                >
                  <span className="text-foreground">
                    {l.customer?.name ?? l.customer?.email ?? copy.anonymous}
                  </span>
                  <span className="rounded-full bg-success/10 px-2 py-0.5 text-success text-[10px] font-bold">
                    {copy.intent} {l.score}
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
