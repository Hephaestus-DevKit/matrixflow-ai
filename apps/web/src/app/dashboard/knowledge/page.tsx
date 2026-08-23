'use client';

import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { apiClient, type ListPage } from '@/lib/api-client';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { FolderOpen, Plus, FileText, Search } from 'lucide-react';
import type { KnowledgeBaseSummary } from '@matrixflow/shared';
import { EmptyState, ErrorState, LoadingCards } from '@/components/ui/states';
import { PageHeader } from '@/components/ui/page';
import { useLocale, type Locale } from '@/lib/i18n';
import { PaginationBar } from '@/components/ui/pagination';
import { ListToolbar } from '@/components/ui/list-toolbar';

const PAGE_SIZE = 24;

const COPY: Record<
  Locale,
  {
    eyebrow: string;
    title: string;
    description: string;
    create: string;
    empty: string;
    emptyDescription: string;
    first: string;
    documents: string;
    noMatches: string;
    clearFilter: string;
    results: (visible: number, pageTotal: number, total: number) => string;
  }
> = {
  'zh-CN': {
    eyebrow: '知识库与 RAG',
    title: '知识库',
    description: '上传并管理产品说明、问答和历史业务资料。',
    create: '新建知识库',
    empty: '暂无关联知识库',
    emptyDescription: '新建专属知识库并上传企业文档，为 AI 员工提供可信的业务上下文。',
    first: '创建第一个知识库',
    documents: '个知识文档',
    noMatches: '当前页没有匹配的知识库',
    clearFilter: '清除筛选',
    results: (visible, pageTotal, total) => `显示 ${visible}/${pageTotal}，共 ${total} 个`,
  },
  'zh-TW': {
    eyebrow: '知識庫與 RAG',
    title: '知識庫',
    description: '上傳並管理產品說明、問答與歷史業務資料。',
    create: '建立知識庫',
    empty: '暫無關聯知識庫',
    emptyDescription: '建立專屬知識庫並上傳企業文件，為 AI 員工提供可信的業務脈絡。',
    first: '建立第一個知識庫',
    documents: '個知識文件',
    noMatches: '目前頁面沒有符合的知識庫',
    clearFilter: '清除篩選',
    results: (visible, pageTotal, total) => `顯示 ${visible}/${pageTotal}，共 ${total} 個`,
  },
  en: {
    eyebrow: 'Knowledge & RAG',
    title: 'Knowledge base',
    description: 'Upload and manage product references, Q&A, and historical business material.',
    create: 'Create knowledge base',
    empty: 'No linked knowledge bases',
    emptyDescription:
      'Create a dedicated knowledge base and upload documents to give AI workers trusted context.',
    first: 'Create your first knowledge base',
    documents: 'documents',
    noMatches: 'No knowledge bases on this page match the filter',
    clearFilter: 'Clear filter',
    results: (visible, pageTotal, total) => `${visible} of ${pageTotal} shown · ${total} total`,
  },
};

export default function KbListPage() {
  const { locale } = useLocale();
  const copy = COPY[locale];
  const [offset, setOffset] = useState(0);
  const [filter, setFilter] = useState('');
  const {
    data: page,
    isLoading,
    isError,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ['kb', offset],
    queryFn: () =>
      apiClient.get<ListPage<KnowledgeBaseSummary>>(`/kb?limit=${PAGE_SIZE}&offset=${offset}`),
    placeholderData: (previous) => previous,
  });
  const kbs = page?.data;
  const visibleKbs = useMemo(() => {
    const needle = filter.trim().toLocaleLowerCase(locale);
    if (!needle) return kbs ?? [];
    return (kbs ?? []).filter((kb) =>
      [kb.name, kb.description ?? ''].join(' ').toLocaleLowerCase(locale).includes(needle),
    );
  }, [filter, kbs, locale]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={copy.eyebrow}
        title={copy.title}
        description={copy.description}
        actions={
          <Button asChild className="gap-1.5 text-xs font-semibold">
            <Link href="/dashboard/knowledge/new">
              <Plus className="h-3.5 w-3.5" /> {copy.create}
            </Link>
          </Button>
        }
      />

      {isLoading && <LoadingCards />}
      {isError && <ErrorState onRetry={() => void refetch()} />}

      {!isLoading && !isError && page && page.total > 0 && (
        <ListToolbar
          value={filter}
          onChange={setFilter}
          resultLabel={copy.results(visibleKbs.length, kbs?.length ?? 0, page.total)}
        />
      )}

      {!isLoading && !isError && kbs && kbs.length === 0 && (
        <EmptyState
          icon={FolderOpen}
          title={copy.empty}
          description={copy.emptyDescription}
          action={
            <Button asChild size="sm" variant="outline" className="text-xs">
              <Link href="/dashboard/knowledge/new">{copy.first}</Link>
            </Button>
          }
        />
      )}

      {filter && kbs && kbs.length > 0 && visibleKbs.length === 0 && (
        <EmptyState
          icon={Search}
          title={copy.noMatches}
          action={
            <Button size="sm" variant="outline" onClick={() => setFilter('')}>
              {copy.clearFilter}
            </Button>
          }
        />
      )}

      {visibleKbs.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visibleKbs.map((kb) => (
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
                  {kb._count?.documents ?? 0} {copy.documents}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
      {page && (
        <PaginationBar
          offset={page.offset}
          limit={page.limit}
          total={page.total}
          nextOffset={page.nextOffset}
          busy={isFetching}
          onChange={(nextOffset) => {
            setOffset(nextOffset);
            setFilter('');
          }}
        />
      )}
    </div>
  );
}
