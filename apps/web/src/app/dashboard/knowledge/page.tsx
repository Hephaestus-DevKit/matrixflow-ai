'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { FolderOpen, Plus, FileText } from 'lucide-react';
import type { KnowledgeBaseSummary } from '@matrixflow/shared';
import { EmptyState, ErrorState, LoadingCards } from '@/components/ui/states';
import { PageHeader } from '@/components/ui/page';

export default function KbListPage() {
  const {
    data: kbs,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['kb'],
    queryFn: () => apiClient.get<KnowledgeBaseSummary[]>('/kb'),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Knowledge & RAG"
        title="知识库"
        description="上传并管理产品说明、问答和历史业务资料。"
        actions={
          <Button asChild className="gap-1.5 text-xs font-semibold">
            <Link href="/dashboard/knowledge/new">
              <Plus className="h-3.5 w-3.5" /> 新建知识库
            </Link>
          </Button>
        }
      />

      {isLoading && <LoadingCards />}
      {isError && <ErrorState onRetry={() => void refetch()} />}

      {!isLoading && !isError && kbs && kbs.length === 0 && (
        <EmptyState
          icon={FolderOpen}
          title="暂无关联知识库"
          description="新建专属知识库并上传企业文档，为 AI 员工提供可信的业务上下文。"
          action={
            <Button asChild size="sm" variant="outline" className="text-xs">
              <Link href="/dashboard/knowledge/new">创建第一个知识库</Link>
            </Button>
          }
        />
      )}

      {kbs && kbs.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {kbs.map((kb) => (
            <Link
              key={kb.id}
              href={`/dashboard/knowledge/${kb.id}`}
              className="interactive-card group flex flex-col justify-between p-5"
            >
              <div>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/5 text-primary group-hover:bg-primary/10 transition-colors mb-4">
                  <FolderOpen className="h-5 w-5" />
                </div>
                <h3 className="font-bold text-foreground text-sm group-hover:text-primary transition-colors">
                  {kb.name}
                </h3>
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                  <FileText className="h-3.5 w-3.5" />
                  {kb._count?.documents ?? 0} 个知识文档
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
