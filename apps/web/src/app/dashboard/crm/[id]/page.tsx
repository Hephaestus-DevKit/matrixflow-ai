'use client';

import { useQuery, useMutation } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { AiReply, CustomerDetail } from '@matrixflow/shared';
import { toast } from 'sonner';
import { errorMessage } from '@/lib/errors';
import { ErrorState, PageLoader } from '@/components/ui/states';
import { useLocale, type Locale } from '@/lib/i18n';

const COPY: Record<
  Locale,
  {
    conversationMissing: string;
    added: string;
    addFailed: string;
    aiFailed: string;
    loading: string;
    notFound: string;
    stage: string;
    source: string;
    tags: string;
    notes: string;
    internal: string;
    internalDescription: string;
    aiSuggest: string;
    noMessages: string;
    reply: string;
    adding: string;
    addRecord: string;
  }
> = {
  'zh-CN': {
    conversationMissing: '未找到对话',
    added: '已添加内部对话记录',
    addFailed: '无法添加对话记录',
    aiFailed: '无法生成回复建议',
    loading: '正在加载客户详情',
    notFound: '未找到该客户，或当前团队无权访问。',
    stage: '阶段',
    source: '来源',
    tags: '标签',
    notes: '备注',
    internal: '内部对话',
    internalDescription: '记录不会自动发送到外部渠道。',
    aiSuggest: '生成 AI 回复建议',
    noMessages: '暂无内部对话记录。',
    reply: '回复…',
    adding: '添加中…',
    addRecord: '添加记录',
  },
  'zh-TW': {
    conversationMissing: '找不到對話',
    added: '已新增內部對話記錄',
    addFailed: '無法新增對話記錄',
    aiFailed: '無法生成回覆建議',
    loading: '正在載入客戶詳情',
    notFound: '找不到該客戶，或目前團隊無權存取。',
    stage: '階段',
    source: '來源',
    tags: '標籤',
    notes: '備註',
    internal: '內部對話',
    internalDescription: '記錄不會自動發送到外部渠道。',
    aiSuggest: '生成 AI 回覆建議',
    noMessages: '暫無內部對話記錄。',
    reply: '回覆…',
    adding: '新增中…',
    addRecord: '新增記錄',
  },
  en: {
    conversationMissing: 'Conversation not found',
    added: 'Internal conversation added',
    addFailed: 'Could not add the conversation record',
    aiFailed: 'Could not generate a reply suggestion',
    loading: 'Loading customer details',
    notFound: 'Customer not found, or this team cannot access it.',
    stage: 'Stage',
    source: 'Source',
    tags: 'Tags',
    notes: 'Notes',
    internal: 'Internal conversation',
    internalDescription: 'Records are never sent to external channels automatically.',
    aiSuggest: 'Generate AI reply suggestion',
    noMessages: 'No internal conversation records yet.',
    reply: 'Reply…',
    adding: 'Adding…',
    addRecord: 'Add record',
  },
};

export default function CustomerDetailPage() {
  const { locale } = useLocale();
  const copy = COPY[locale];
  const { id } = useParams();
  const [reply, setReply] = useState('');
  const {
    data: c,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['customer', id],
    queryFn: () => apiClient.get<CustomerDetail>(`/crm/customers/${id}`),
    enabled: !!id,
  });
  const conv = c?.conversations?.[0];
  const send = useMutation({
    mutationFn: (content: string) =>
      conv
        ? apiClient.post(`/crm/conversations/${conv.id}/messages`, { role: 'agent', content })
        : Promise.reject(new Error(copy.conversationMissing)),
    onSuccess: async () => {
      setReply('');
      await refetch();
      toast.success(copy.added);
    },
    onError: (error: unknown) => toast.error(errorMessage(error, copy.addFailed)),
  });
  const aiReply = useMutation({
    mutationFn: () =>
      conv
        ? apiClient.post<AiReply>(`/crm/conversations/${conv.id}/ai-reply`, {})
        : Promise.reject(new Error(copy.conversationMissing)),
    onSuccess: (response) => setReply(response.reply ?? JSON.stringify(response)),
    onError: (error: unknown) => toast.error(errorMessage(error, copy.aiFailed)),
  });

  if (isLoading) return <PageLoader label={copy.loading} />;
  if (isError) return <ErrorState onRetry={() => void refetch()} />;
  if (!c) return <ErrorState message={copy.notFound} />;
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-4">
        <h1 className="text-xl font-bold">{c.name ?? c.email}</h1>
        <p className="text-sm text-muted-foreground">
          {copy.stage}: {c.stage} · {copy.source}: {c.source}
        </p>
        <div>
          <h2 className="text-sm font-semibold">{copy.tags}</h2>
          <div className="flex flex-wrap gap-1">
            {c.tags?.map((tag) => (
              <span key={tag.tag} className="rounded bg-muted px-2 py-0.5 text-xs">
                {tag.tag}
              </span>
            ))}
          </div>
        </div>
        <div>
          <h2 className="text-sm font-semibold">{copy.notes}</h2>
          {c.notes?.map((note) => (
            <p key={note.id} className="text-sm">
              {note.content}
            </p>
          ))}
        </div>
      </div>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold">{copy.internal}</h2>
            <p className="mt-1 text-xs text-muted-foreground">{copy.internalDescription}</p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => aiReply.mutate()}
            disabled={aiReply.isPending}
          >
            {copy.aiSuggest}
          </Button>
        </div>
        <div className="max-h-96 space-y-2 overflow-auto rounded-lg border border-border p-3">
          {conv?.messages?.map((message) => (
            <div
              key={message.id}
              className={`text-sm ${message.role === 'customer' ? 'text-left' : 'text-right'}`}
            >
              <span className="rounded bg-muted px-2 py-1 inline-block">{message.content}</span>
            </div>
          ))}
          {(!conv?.messages || conv.messages.length === 0) && (
            <p className="py-8 text-center text-xs text-muted-foreground">{copy.noMessages}</p>
          )}
        </div>
        <div className="flex gap-2">
          <Input
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder={copy.reply}
          />
          <Button onClick={() => send.mutate(reply)} disabled={!reply.trim() || send.isPending}>
            {send.isPending ? copy.adding : copy.addRecord}
          </Button>
        </div>
      </div>
    </div>
  );
}
