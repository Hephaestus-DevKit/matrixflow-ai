'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { KnowledgeBaseDetail, RagAnswer } from '@matrixflow/shared';
import { toast } from 'sonner';
import { errorMessage } from '@/lib/errors';
import { ErrorState, PageLoader } from '@/components/ui/states';
import { FileText, RefreshCw, Trash2, Upload } from 'lucide-react';

export default function KbDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<RagAnswer | null>(null);
  const [asking, setAsking] = useState(false);
  const {
    data: kb,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['kb', id],
    queryFn: () => apiClient.get<KnowledgeBaseDetail>(`/kb/${id}`),
    enabled: !!id,
  });

  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    try {
      const result = await apiClient.upload<{ status?: string; error?: string }>(
        `/kb/${id}/documents`,
        fd,
      );
      await refetch();
      if (result.status === 'ERROR') toast.error(result.error || '文件已上传，但索引失败');
      else toast.success('文件上传并完成索引');
    } catch (error) {
      toast.error(errorMessage(error, '文件上传失败'));
    } finally {
      e.target.value = '';
    }
  }

  async function ask() {
    if (!question) return;
    setAsking(true);
    try {
      const r = await apiClient.post<RagAnswer>(`/kb/${id}/ask`, { question });
      setAnswer(r);
    } catch (error) {
      toast.error(errorMessage(error, '知识库问答失败'));
    } finally {
      setAsking(false);
    }
  }

  async function retryIndex(documentId: string) {
    try {
      await apiClient.post('/kb/index', { documentId });
      await refetch();
      toast.success('文档索引已完成');
    } catch (error) {
      await refetch();
      toast.error(errorMessage(error, '重新索引失败'));
    }
  }

  async function removeDocument(documentId: string) {
    if (!window.confirm('确定删除该文档及其存储文件吗？')) return;
    try {
      await apiClient.del(`/kb/${id}/documents/${documentId}`);
      await refetch();
      toast.success('文档已删除');
    } catch (error) {
      toast.error(errorMessage(error, '文档删除失败'));
    }
  }

  async function removeKnowledgeBase() {
    if (!window.confirm('确定删除整个知识库及其全部文档吗？此操作不可撤销。')) return;
    try {
      await apiClient.del(`/kb/${id}`);
      toast.success('知识库已删除');
      router.push('/dashboard/knowledge');
    } catch (error) {
      toast.error(errorMessage(error, '知识库删除失败'));
    }
  }

  if (isLoading) return <PageLoader label="正在加载知识库" />;
  if (isError) return <ErrorState onRetry={() => void refetch()} />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold">{kb?.name ?? '知识库'}</h1>
          {kb?.description && (
            <p className="mt-1 text-sm text-muted-foreground">{kb.description}</p>
          )}
        </div>
        <Button
          variant="outline"
          className="text-destructive"
          onClick={() => void removeKnowledgeBase()}
        >
          <Trash2 className="h-4 w-4" /> 删除知识库
        </Button>
      </div>
      <label className="surface-card flex cursor-pointer items-center justify-center gap-2 border-dashed p-5 text-sm font-semibold text-primary hover:border-primary/40">
        <Upload className="h-4 w-4" /> 上传 PDF、DOCX、TXT、Markdown 或 CSV（最大 20 MB）
        <input
          type="file"
          accept=".pdf,.docx,.txt,.md,.csv"
          onChange={upload}
          className="sr-only"
        />
      </label>
      <div>
        <h2 className="mb-2 text-sm font-semibold text-muted-foreground">文档列表</h2>
        {kb?.documents?.length === 0 && (
          <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            还没有文档。上传资料并完成索引后即可提问。
          </p>
        )}
        {kb?.documents?.map((document) => (
          <div
            key={document.id}
            className="flex items-center justify-between rounded-lg border border-border px-4 py-2 text-sm"
          >
            <span className="flex min-w-0 items-center gap-2">
              <FileText className="h-4 w-4 shrink-0 text-primary" />
              <span className="truncate">{document.title}</span>
            </span>
            <span className="flex items-center gap-2">
              <span
                className={
                  document.status === 'READY'
                    ? 'text-success'
                    : document.status === 'ERROR'
                      ? 'text-destructive'
                      : 'text-muted-foreground'
                }
              >
                {document.status === 'READY'
                  ? '已就绪'
                  : document.status === 'ERROR'
                    ? '索引失败'
                    : '处理中'}
              </span>
              {document.status === 'ERROR' && (
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="重新索引"
                  onClick={() => void retryIndex(document.id)}
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                aria-label="删除文档"
                onClick={() => void removeDocument(document.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </span>
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
          <div className="surface-card p-5">
            <p className="whitespace-pre-wrap text-sm leading-7">{answer.answer}</p>
            {answer.citations?.length > 0 && (
              <div className="mt-5 border-t border-border pt-4">
                <p className="text-xs font-bold text-muted-foreground">引用资料</p>
                <div className="mt-2 space-y-2">
                  {answer.citations.map((citation) => (
                    <div
                      key={citation.chunkId}
                      className="rounded-lg bg-muted/50 p-3 text-xs leading-5 text-muted-foreground"
                    >
                      <strong className="text-foreground">{citation.title}</strong>：
                      {citation.snippet}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
