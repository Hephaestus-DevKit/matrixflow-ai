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
import { useLocale, type Locale } from '@/lib/i18n';

const COPY: Record<
  Locale,
  {
    loading: string;
    uploadError: string;
    uploadDone: string;
    uploadFailed: string;
    askFailed: string;
    indexed: string;
    reindexFailed: string;
    deleteDocumentConfirm: string;
    deleteDocument: string;
    documentDeleted: string;
    deleteKbConfirm: string;
    kbDeleted: string;
    deleteKbFailed: string;
    loadingKb: string;
    kbFallback: string;
    deleteKb: string;
    upload: string;
    documents: string;
    noDocuments: string;
    ready: string;
    indexFailed: string;
    processing: string;
    reindex: string;
    rag: string;
    askPlaceholder: string;
    ask: string;
    references: string;
  }
> = {
  'zh-CN': {
    loading: '加载中…',
    uploadError: '文件已上传，但索引失败',
    uploadDone: '文件上传并完成索引',
    uploadFailed: '文件上传失败',
    askFailed: '知识库问答失败',
    indexed: '文档索引已完成',
    reindexFailed: '重新索引失败',
    deleteDocumentConfirm: '确定删除该文档及其存储文件吗？',
    deleteDocument: '删除文档',
    documentDeleted: '文档已删除',
    deleteKbConfirm: '确定删除整个知识库及其全部文档吗？此操作不可撤销。',
    kbDeleted: '知识库已删除',
    deleteKbFailed: '知识库删除失败',
    loadingKb: '正在加载知识库',
    kbFallback: '知识库',
    deleteKb: '删除知识库',
    upload: '上传 PDF、DOCX、TXT、Markdown 或 CSV（最大 20 MB）',
    documents: '文档列表',
    noDocuments: '还没有文档。上传资料并完成索引后即可提问。',
    ready: '已就绪',
    indexFailed: '索引失败',
    processing: '处理中',
    reindex: '重新索引',
    rag: 'RAG 问答',
    askPlaceholder: '问一个问题…',
    ask: '提问',
    references: '引用资料',
  },
  'zh-TW': {
    loading: '載入中…',
    uploadError: '檔案已上傳，但索引失敗',
    uploadDone: '檔案上傳並完成索引',
    uploadFailed: '檔案上傳失敗',
    askFailed: '知識庫問答失敗',
    indexed: '文件索引已完成',
    reindexFailed: '重新索引失敗',
    deleteDocumentConfirm: '確定刪除此文件及其儲存檔案嗎？',
    deleteDocument: '刪除文件',
    documentDeleted: '文件已刪除',
    deleteKbConfirm: '確定刪除整個知識庫及其全部文件嗎？此操作不可撤銷。',
    kbDeleted: '知識庫已刪除',
    deleteKbFailed: '知識庫刪除失敗',
    loadingKb: '正在載入知識庫',
    kbFallback: '知識庫',
    deleteKb: '刪除知識庫',
    upload: '上傳 PDF、DOCX、TXT、Markdown 或 CSV（最大 20 MB）',
    documents: '文件列表',
    noDocuments: '還沒有文件。上傳資料並完成索引後即可提問。',
    ready: '已就緒',
    indexFailed: '索引失敗',
    processing: '處理中',
    reindex: '重新索引',
    rag: 'RAG 問答',
    askPlaceholder: '問一個問題…',
    ask: '提問',
    references: '引用資料',
  },
  en: {
    loading: 'Loading…',
    uploadError: 'The file uploaded, but indexing failed',
    uploadDone: 'File uploaded and indexed',
    uploadFailed: 'File upload failed',
    askFailed: 'Knowledge-base Q&A failed',
    indexed: 'Document indexed',
    reindexFailed: 'Re-indexing failed',
    deleteDocumentConfirm: 'Delete this document and its stored file?',
    deleteDocument: 'Delete document',
    documentDeleted: 'Document deleted',
    deleteKbConfirm: 'Delete this knowledge base and all documents? This cannot be undone.',
    kbDeleted: 'Knowledge base deleted',
    deleteKbFailed: 'Could not delete the knowledge base',
    loadingKb: 'Loading knowledge base',
    kbFallback: 'Knowledge base',
    deleteKb: 'Delete knowledge base',
    upload: 'Upload PDF, DOCX, TXT, Markdown, or CSV (20 MB max)',
    documents: 'Documents',
    noDocuments: 'No documents yet. Upload and index material before asking a question.',
    ready: 'Ready',
    indexFailed: 'Index failed',
    processing: 'Processing',
    reindex: 'Re-index',
    rag: 'RAG Q&A',
    askPlaceholder: 'Ask a question…',
    ask: 'Ask',
    references: 'Sources',
  },
};

export default function KbDetailPage() {
  const { locale } = useLocale();
  const copy = COPY[locale];
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
      if (result.status === 'ERROR') toast.error(result.error || copy.uploadError);
      else toast.success(copy.uploadDone);
    } catch (error) {
      toast.error(errorMessage(error, copy.uploadFailed));
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
      toast.error(errorMessage(error, copy.askFailed));
    } finally {
      setAsking(false);
    }
  }

  async function retryIndex(documentId: string) {
    try {
      await apiClient.post('/kb/index', { documentId });
      await refetch();
      toast.success(copy.indexed);
    } catch (error) {
      await refetch();
      toast.error(errorMessage(error, copy.reindexFailed));
    }
  }

  async function removeDocument(documentId: string) {
    if (!window.confirm(copy.deleteDocumentConfirm)) return;
    try {
      await apiClient.del(`/kb/${id}/documents/${documentId}`);
      await refetch();
      toast.success(copy.documentDeleted);
    } catch (error) {
      toast.error(errorMessage(error, copy.deleteDocument));
    }
  }

  async function removeKnowledgeBase() {
    if (!window.confirm(copy.deleteKbConfirm)) return;
    try {
      await apiClient.del(`/kb/${id}`);
      toast.success(copy.kbDeleted);
      router.push('/dashboard/knowledge');
    } catch (error) {
      toast.error(errorMessage(error, copy.deleteKbFailed));
    }
  }

  if (isLoading) return <PageLoader label={copy.loadingKb} />;
  if (isError) return <ErrorState onRetry={() => void refetch()} />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold">{kb?.name ?? copy.kbFallback}</h1>
          {kb?.description && (
            <p className="mt-1 text-sm text-muted-foreground">{kb.description}</p>
          )}
        </div>
        <Button
          variant="outline"
          className="text-destructive"
          onClick={() => void removeKnowledgeBase()}
        >
          <Trash2 className="h-4 w-4" /> {copy.deleteKb}
        </Button>
      </div>
      <label className="surface-card flex cursor-pointer items-center justify-center gap-2 border-dashed p-5 text-sm font-semibold text-primary hover:border-primary/40">
        <Upload className="h-4 w-4" /> {copy.upload}
        <input
          type="file"
          accept=".pdf,.docx,.txt,.md,.csv"
          onChange={upload}
          className="sr-only"
        />
      </label>
      <div>
        <h2 className="mb-2 text-sm font-semibold text-muted-foreground">{copy.documents}</h2>
        {kb?.documents?.length === 0 && (
          <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            {copy.noDocuments}
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
                  ? copy.ready
                  : document.status === 'ERROR'
                    ? copy.indexFailed
                    : copy.processing}
              </span>
              {document.status === 'ERROR' && (
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={copy.reindex}
                  onClick={() => void retryIndex(document.id)}
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                aria-label={copy.deleteDocument}
                onClick={() => void removeDocument(document.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </span>
          </div>
        ))}
      </div>
      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground">{copy.rag}</h2>
        <div className="flex gap-2">
          <Input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder={copy.askPlaceholder}
            onKeyDown={(e) => e.key === 'Enter' && ask()}
          />
          <Button onClick={ask} disabled={asking}>
            {asking ? '…' : copy.ask}
          </Button>
        </div>
        {answer && (
          <div className="surface-card p-5">
            <p className="whitespace-pre-wrap text-sm leading-7">{answer.answer}</p>
            {answer.citations?.length > 0 && (
              <div className="mt-5 border-t border-border pt-4">
                <p className="text-xs font-bold text-muted-foreground">{copy.references}</p>
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
