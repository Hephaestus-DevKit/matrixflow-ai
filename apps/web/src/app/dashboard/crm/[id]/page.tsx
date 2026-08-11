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

export default function CustomerDetailPage() {
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
        : Promise.reject(new Error('Conversation not found')),
    onSuccess: async () => {
      setReply('');
      await refetch();
      toast.success('已添加内部对话记录');
    },
    onError: (error: unknown) => toast.error(errorMessage(error, '无法添加对话记录')),
  });
  const aiReply = useMutation({
    mutationFn: () =>
      conv
        ? apiClient.post<AiReply>(`/crm/conversations/${conv.id}/ai-reply`, {})
        : Promise.reject(new Error('Conversation not found')),
    onSuccess: (response) => setReply(response.reply ?? JSON.stringify(response)),
    onError: (error: unknown) => toast.error(errorMessage(error, '无法生成回复建议')),
  });

  if (isLoading) return <PageLoader label="正在加载客户详情" />;
  if (isError) return <ErrorState onRetry={() => void refetch()} />;
  if (!c) return <ErrorState message="未找到该客户，或当前团队无权访问。" />;
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-4">
        <h1 className="text-xl font-bold">{c.name ?? c.email}</h1>
        <p className="text-sm text-muted-foreground">
          阶段：{c.stage} · 来源：{c.source}
        </p>
        <div>
          <h2 className="text-sm font-semibold">标签</h2>
          <div className="flex flex-wrap gap-1">
            {c.tags?.map((tag) => (
              <span key={tag.tag} className="rounded bg-muted px-2 py-0.5 text-xs">
                {tag.tag}
              </span>
            ))}
          </div>
        </div>
        <div>
          <h2 className="text-sm font-semibold">备注</h2>
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
            <h2 className="text-sm font-semibold">内部对话</h2>
            <p className="mt-1 text-xs text-muted-foreground">记录不会自动发送到外部渠道。</p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => aiReply.mutate()}
            disabled={aiReply.isPending}
          >
            生成 AI 回复建议
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
            <p className="py-8 text-center text-xs text-muted-foreground">暂无内部对话记录。</p>
          )}
        </div>
        <div className="flex gap-2">
          <Input value={reply} onChange={(e) => setReply(e.target.value)} placeholder="回复..." />
          <Button onClick={() => send.mutate(reply)} disabled={!reply.trim() || send.isPending}>
            {send.isPending ? '添加中…' : '添加记录'}
          </Button>
        </div>
      </div>
    </div>
  );
}
