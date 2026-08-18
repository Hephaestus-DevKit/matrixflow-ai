'use client';

import { useQuery } from '@tanstack/react-query';
import { ExternalLink, FileText, Receipt } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { useLocale, type Locale } from '@/lib/i18n';
import { ErrorState, LoadingCards } from '@/components/ui/states';

type Invoice = {
  id: string;
  externalInvoiceId: string;
  status: string;
  amountCents: number;
  currency: string;
  hostedUrl?: string | null;
  issuedAt?: string | null;
  paidAt?: string | null;
};

type Transaction = {
  id: string;
  externalTransactionId: string;
  type: string;
  status: string;
  amountCents: number;
  currency: string;
  processedAt?: string | null;
};

const COPY: Record<
  Locale,
  {
    title: string;
    invoices: string;
    transactions: string;
    empty: string;
    invoice: string;
    transaction: string;
    paid: string;
    status: string;
    open: string;
    statuses: Record<string, string>;
    transactionTypes: Record<string, string>;
  }
> = {
  'zh-CN': {
    title: '账单记录',
    invoices: '发票',
    transactions: '交易',
    empty: '暂时没有账单记录。',
    invoice: '发票',
    transaction: '交易',
    paid: '已支付',
    status: '状态',
    open: '查看',
    statuses: { paid: '已支付', open: '待支付', void: '已作废', uncollectible: '无法收款' },
    transactionTypes: { payment: '付款', refund: '退款', chargeback: '拒付', adjustment: '调整' },
  },
  'zh-TW': {
    title: '帳單記錄',
    invoices: '發票',
    transactions: '交易',
    empty: '暫時沒有帳單記錄。',
    invoice: '發票',
    transaction: '交易',
    paid: '已支付',
    status: '狀態',
    open: '查看',
    statuses: { paid: '已支付', open: '待支付', void: '已作廢', uncollectible: '無法收款' },
    transactionTypes: { payment: '付款', refund: '退款', chargeback: '拒付', adjustment: '調整' },
  },
  en: {
    title: 'Billing history',
    invoices: 'Invoices',
    transactions: 'Transactions',
    empty: 'No billing records yet.',
    invoice: 'Invoice',
    transaction: 'Transaction',
    paid: 'Paid',
    status: 'Status',
    open: 'Open',
    statuses: { paid: 'Paid', open: 'Open', void: 'Voided', uncollectible: 'Uncollectible' },
    transactionTypes: {
      payment: 'Payment',
      refund: 'Refund',
      chargeback: 'Chargeback',
      adjustment: 'Adjustment',
    },
  },
};

function money(cents: number, currency: string, locale: Locale) {
  return new Intl.NumberFormat(locale === 'en' ? 'en-US' : locale === 'zh-TW' ? 'zh-TW' : 'zh-CN', {
    style: 'currency',
    currency: currency || 'USD',
  }).format(Number(cents || 0) / 100);
}

function date(value: string | null | undefined, locale: Locale) {
  if (!value) return '—';
  return new Intl.DateTimeFormat(
    locale === 'en' ? 'en-US' : locale === 'zh-TW' ? 'zh-TW' : 'zh-CN',
    { dateStyle: 'medium' },
  ).format(new Date(value));
}

function statusLabel(value: string, copy: (typeof COPY)[Locale]) {
  const normalized = String(value || '').toLowerCase();
  return copy.statuses[normalized] || value || '—';
}

function transactionTypeLabel(value: string, copy: (typeof COPY)[Locale]) {
  const normalized = String(value || '').toLowerCase();
  return copy.transactionTypes[normalized] || value || '—';
}

export function BillingHistoryCard() {
  const { locale } = useLocale();
  const copy = COPY[locale];
  const invoices = useQuery({
    queryKey: ['billing-invoices'],
    queryFn: () => apiClient.get<Invoice[]>('/billing/invoices'),
  });
  const transactions = useQuery({
    queryKey: ['billing-transactions'],
    queryFn: () => apiClient.get<Transaction[]>('/billing/transactions'),
  });
  const loading = invoices.isLoading || transactions.isLoading;
  const failed = invoices.isError || transactions.isError;
  if (loading) return <LoadingCards count={1} />;
  if (failed) {
    return (
      <ErrorState
        onRetry={() => {
          void invoices.refetch();
          void transactions.refetch();
        }}
      />
    );
  }
  const invoiceRows = invoices.data || [];
  const transactionRows = transactions.data || [];
  if (!invoiceRows.length && !transactionRows.length) {
    return <p className="text-xs text-muted-foreground">{copy.empty}</p>;
  }
  return (
    <section className="surface-card overflow-hidden">
      <div className="flex items-center gap-2 border-b border-border/60 px-5 py-4">
        <Receipt className="h-4 w-4 text-primary" aria-hidden="true" />
        <h3 className="text-sm font-bold">{copy.title}</h3>
      </div>
      <div className="grid gap-5 p-5 lg:grid-cols-2">
        <div>
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-muted-foreground">
            <FileText className="h-3.5 w-3.5" />
            {copy.invoices}
          </div>
          {invoiceRows.length ? (
            <div className="space-y-2">
              {invoiceRows.map((invoice) => (
                <div
                  key={invoice.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border/50 bg-muted/10 px-3 py-2.5 text-xs"
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{invoice.externalInvoiceId}</p>
                    <p className="mt-1 text-2xs text-muted-foreground">
                      {date(invoice.issuedAt, locale)} · {statusLabel(invoice.status, copy)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">
                      {money(invoice.amountCents, invoice.currency, locale)}
                    </span>
                    {invoice.hostedUrl && (
                      <a
                        href={invoice.hostedUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary"
                        aria-label={`${copy.open} ${copy.invoice}`}
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">{copy.empty}</p>
          )}
        </div>
        <div>
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-muted-foreground">
            <Receipt className="h-3.5 w-3.5" />
            {copy.transactions}
          </div>
          {transactionRows.length ? (
            <div className="space-y-2">
              {transactionRows.map((transaction) => (
                <div
                  key={transaction.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border/50 bg-muted/10 px-3 py-2.5 text-xs"
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{transaction.externalTransactionId}</p>
                    <p className="mt-1 text-2xs text-muted-foreground">
                      {date(transaction.processedAt, locale)} ·{' '}
                      {transactionTypeLabel(transaction.type, copy)} · {copy.status}:{' '}
                      {statusLabel(transaction.status, copy)}
                    </p>
                  </div>
                  <span className="font-semibold">
                    {money(transaction.amountCents, transaction.currency, locale)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">{copy.empty}</p>
          )}
        </div>
      </div>
    </section>
  );
}
