'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Bot, Factory, FolderOpen, GitFork, Sparkles, Zap } from 'lucide-react';
import type {
  AgentSummary,
  ContentProjectSummary,
  KnowledgeBaseSummary,
  UsageSummary,
} from '@matrixflow/shared';
import { useAuth } from '@/lib/auth-store';
import { apiClient } from '@/lib/api-client';
import { ErrorState, LoadingCards } from '@/components/ui/states';
import { PageHeader, SectionHeading, StatCard } from '@/components/ui/page';

const QUICK_ACTIONS = [
  {
    href: '/dashboard/content',
    icon: Factory,
    title: '启动内容矩阵',
    description: '从产品资料批量生成 Listing、广告和社媒内容。',
  },
  {
    href: '/dashboard/agents/new',
    icon: Bot,
    title: '部署 AI 员工',
    description: '配置角色、模型、提示词和可调用的业务技能。',
  },
  {
    href: '/dashboard/workflows/new',
    icon: GitFork,
    title: '编排自动化',
    description: '将 AI、判断、Webhook 与业务动作连接成流程。',
  },
] as const;

export default function DashboardPage() {
  const { user } = useAuth();
  const agents = useQuery({
    queryKey: ['agents'],
    queryFn: () => apiClient.get<AgentSummary[]>('/agents'),
  });
  const projects = useQuery({
    queryKey: ['content-projects'],
    queryFn: () => apiClient.get<ContentProjectSummary[]>('/content/projects'),
  });
  const knowledge = useQuery({
    queryKey: ['kb'],
    queryFn: () => apiClient.get<KnowledgeBaseSummary[]>('/kb'),
  });
  const usage = useQuery({
    queryKey: ['usage'],
    queryFn: () => apiClient.get<UsageSummary>('/billing/usage'),
  });
  const queries = [agents, projects, knowledge, usage];
  const isLoading = queries.some((query) => query.isLoading);
  const hasError = queries.some((query) => query.isError);
  const retry = () => void Promise.all(queries.map((query) => query.refetch()));
  const activeAgents = agents.data?.filter((agent) => agent.status === 'ACTIVE').length ?? 0;
  const aiCalls = usage.data?.ai_call ?? 0;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Operations overview"
        title={<>欢迎回来，{user?.name || '伙伴'}</>}
        description="集中查看 AI 团队、内容项目、知识资产与本月资源消耗。"
        actions={
          <Link
            href="/dashboard/agents/new"
            className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary transition hover:bg-primary/15"
          >
            <Sparkles className="h-3.5 w-3.5" /> 部署新员工
          </Link>
        }
      />

      {hasError ? (
        <ErrorState message="部分工作台指标未能加载，请检查连接后重试。" onRetry={retry} />
      ) : isLoading ? (
        <LoadingCards count={4} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="活跃 AI 员工"
            value={activeAgents}
            detail={`共 ${agents.data?.length ?? 0} 个角色`}
            icon={Bot}
          />
          <StatCard
            label="内容项目"
            value={projects.data?.length ?? 0}
            detail="已沉淀的内容生产任务"
            icon={Factory}
            tone="success"
          />
          <StatCard
            label="本月 AI 调用"
            value={aiCalls.toLocaleString()}
            detail="按当前组织汇总"
            icon={Zap}
            tone="warning"
          />
          <StatCard
            label="关联知识库"
            value={knowledge.data?.length ?? 0}
            detail="可用于检索增强生成"
            icon={FolderOpen}
            tone="info"
          />
        </div>
      )}

      <section className="space-y-4">
        <SectionHeading title="快捷入口" description="从最常用的操作开始，减少工作流转路径。" />
        <div className="grid gap-4 md:grid-cols-3">
          {QUICK_ACTIONS.map((action) => {
            const Icon = action.icon;
            return (
              <Link
                key={action.href}
                href={action.href}
                className="interactive-card group p-5 sm:p-6"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="mt-5 flex items-center gap-2 text-sm font-bold text-foreground group-hover:text-primary">
                  {action.title}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </span>
                <span className="mt-2 block text-xs leading-5 text-muted-foreground">
                  {action.description}
                </span>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
