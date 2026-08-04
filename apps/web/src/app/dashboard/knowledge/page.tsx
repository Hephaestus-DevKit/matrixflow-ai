'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { FolderOpen, Plus, FileText } from 'lucide-react';

export default function KbListPage() {
  const { data: kbs, isLoading } = useQuery({
    queryKey: ['kb'],
    queryFn: () => apiClient.get<any[]>('/kb'),
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between border-b border-border/40 pb-5">
        <div>
          <h1 className="text-xl font-bold tracking-tight">知识库</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            上传并管理您的产品说明书、问答及历史宣发资料
          </p>
        </div>
        <Link href="/dashboard/knowledge/new">
          <Button className="gap-1.5 text-xs font-semibold">
            <Plus className="h-3.5 w-3.5" /> 新建知识库
          </Button>
        </Link>
      </div>

      {isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="rounded-xl border border-border/60 bg-card p-5 space-y-4 animate-pulse"
            >
              <div className="flex items-center justify-between">
                <div className="h-9 w-9 rounded-lg bg-muted"></div>
                <div className="h-5 w-12 rounded-full bg-muted"></div>
              </div>
              <div className="space-y-2">
                <div className="h-4 w-1/2 rounded bg-muted"></div>
                <div className="h-3.5 w-1/3 rounded bg-muted"></div>
              </div>
              <div className="border-t border-border/40 pt-3 flex gap-1">
                <div className="h-4 w-16 rounded bg-muted"></div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!isLoading && kbs && kbs.length === 0 && (
        <div className="rounded-xl border border-dashed border-border/60 bg-muted/10 p-12 text-center flex flex-col items-center justify-center">
          <FolderOpen className="h-10 w-10 text-muted-foreground/60 mb-3 animate-pulse-slow" />
          <p className="text-sm font-semibold text-foreground">暂无关联知识库</p>
          <p className="mt-1 text-xs text-muted-foreground max-w-[280px]">
            新建一个专属知识库并上传企业文档，赋予 AI 员工深度业务认知。
          </p>
          <Link href="/dashboard/knowledge/new" className="mt-4">
            <Button size="sm" variant="outline" className="text-xs">
              创建第一个知识库
            </Button>
          </Link>
        </div>
      )}

      {kbs && kbs.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {kbs.map((kb) => (
            <Link
              key={kb.id}
              href={`/dashboard/knowledge/${kb.id}`}
              className="group rounded-xl border border-border/60 bg-card p-5 transition-all duration-300 hover:border-primary/30 hover:shadow-sm flex flex-col justify-between"
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
