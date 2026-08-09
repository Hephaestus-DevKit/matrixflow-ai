'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { KnowledgeBaseDetail, RagAnswer } from '@matrixflow/shared';

export default function KbDetailPage() {
  const { id } = useParams();
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<RagAnswer | null>(null);
  const [asking, setAsking] = useState(false);
  const { data: kb } = useQuery({
    queryKey: ['kb', id],
    queryFn: () => apiClient.get<KnowledgeBaseDetail>(`/kb/${id}`),
    enabled: !!id,
  });

  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    await apiClient.upload(`/kb/${id}/documents`, fd);
    alert('上传成功，正在解析...');
  }

  async function ask() {
    if (!question) return;
    setAsking(true);
    try {
      const r = await apiClient.post<RagAnswer>(`/kb/${id}/ask`, { question });
      setAnswer(r);
    } finally {
      setAsking(false);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">{kb?.name ?? '知识库'}</h1>
      <div>
        <input type="file" onChange={upload} className="text-sm" />
      </div>
      <div>
        <h2 className="mb-2 text-sm font-semibold text-muted-foreground">文档列表</h2>
        {kb?.documents?.map((document) => (
          <div
            key={document.id}
            className="flex items-center justify-between rounded-lg border border-border px-4 py-2 text-sm"
          >
            <span>{document.title}</span>
            <span className="text-muted-foreground">{document.status}</span>
          </div>
        ))}
      </div>
      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground">RAG 问答</h2>
        <div className="flex gap-2">
          <Input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="问一个问题..."
            onKeyDown={(e) => e.key === 'Enter' && ask()}
          />
          <Button onClick={ask} disabled={asking}>
            {asking ? '...' : '提问'}
          </Button>
        </div>
        {answer && (
          <pre className="rounded-lg bg-muted/50 p-4 text-sm">
            {JSON.stringify(answer, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
}
