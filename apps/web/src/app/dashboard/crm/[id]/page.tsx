'use client';

import { useQuery, useMutation } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { AiReply, CustomerDetail } from '@matrixflow/shared';

export default function CustomerDetailPage() {
  const { id } = useParams();
  const [reply, setReply] = useState('');
  const { data: c } = useQuery({
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
    onSuccess: () => setReply(''),
  });
  const aiReply = useMutation({
    mutationFn: () =>
      conv
        ? apiClient.post<AiReply>(`/crm/conversations/${conv.id}/ai-reply`, {})
        : Promise.reject(new Error('Conversation not found')),
    onSuccess: (response) => setReply(response.reply ?? JSON.stringify(response)),
  });

  if (!c) return <p className="text-muted-foreground">加载中...</p>;
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
          <h2 className="text-sm font-semibold">对话</h2>
          <Button
            size="sm"
            variant="outline"
            onClick={() => aiReply.mutate()}
            disabled={aiReply.isPending}
          >
            AI 回复建议
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
        </div>
        <div className="flex gap-2">
          <Input value={reply} onChange={(e) => setReply(e.target.value)} placeholder="回复..." />
          <Button onClick={() => send.mutate(reply)} disabled={!reply}>
            发送
          </Button>
        </div>
      </div>
    </div>
  );
}
