'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowRight,
  Bot,
  CheckCircle2,
  Circle,
  Factory,
  FolderOpen,
  GitFork,
  Sparkles,
  Zap,
} from 'lucide-react';
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
    description: '将 AI、条件判断与数据转换连接成可追踪流程。',
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
  const health = useQuery({
    queryKey: ['system-health'],
    queryFn: () =>
      apiClient.get<{
        status: string;
        ai: { ready: boolean; provider?: string; model?: string };
        limits: { monthlyAiCalls: number };
      }>('/health'),
    staleTime: 60_000,
  });
  const queries = [agents, projects, knowledge, usage, health];
  const isLoading = queries.some((query) => query.isLoading);
  const hasError = queries.some((query) => query.isError);
  const retry = () => void Promise.all(queries.map((query) => query.refetch()));
  const activeAgents = agents.data?.filter((agent) => agent.status === 'ACTIVE').length ?? 0;
  const aiCalls = usage.data?.ai_call ?? 0;
  const onboarding = [
    { label: '连接 AI 服务', done: Boolean(health.data?.ai.ready), href: '/dashboard/settings' },
    {
      label: '创建知识库',
      done: Boolean(knowledge.data?.length),
      href: '/dashboard/knowledge/new',
    },
    { label: '创建 AI 员工', done: Boolean(agents.data?.length), href: '/dashboard/agents/new' },
    { label: '建立内容项目', done: Boolean(projects.data?.length), href: '/dashboard/content' },
  ] as const;
  const onboardingComplete = onboarding.every((step) => step.done);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="团队运行概况"
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

      {health.data && (
        <section
          className={`flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between ${
            health.data.ai.ready
              ? 'border-emerald-500/20 bg-emerald-500/[0.06]'
              : 'border-amber-500/20 bg-amber-500/[0.07]'
          }`}
          role="status"
        >
          <div className="flex items-start gap-3">
            {health.data.ai.ready ? (
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" />
            ) : (
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
            )}
            <div>
              <p className="text-sm font-bold">
                {health.data.ai.ready ? 'AI 服务已就绪' : '数据服务已连接，AI 服务尚未配置'}
              </p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {health.data.ai.ready
                  ? `${health.data.ai.provider} · ${health.data.ai.model} · 每月 ${health.data.limits.monthlyAiCalls} 次额度`
                  : '内容生成、知识问答、Agent 与 AI 工作流会安全拒绝请求，直到管理员在 Appwrite Function 中配置模型密钥。'}
              </p>
            </div>
          </div>
        </section>
      )}

      {!isLoading && !onboardingComplete && (
        <section className="surface-card p-5 sm:p-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-base font-bold">首次运行清单</h2>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                按顺序完成基础配置，形成可验证的内容与知识闭环。
              </p>
            </div>
            <span className="text-xs font-semibold text-muted-foreground">
              {onboarding.filter((step) => step.done).length} / {onboarding.length} 已完成
            </span>
          </div>
          <div className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {onboarding.map((step, index) => (
              <Link
                key={step.label}
                href={step.href}
                className="flex items-center gap-3 rounded-xl border border-border/70 bg-background/60 p-3 text-sm transition hover:border-primary/30 hover:bg-primary/[0.04]"
              >
                {step.done ? (
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-success" />
                ) : (
                  <Circle className="h-5 w-5 shrink-0 text-muted-foreground" />
                )}
                <span>
                  <span className="block text-[0.6875rem] text-muted-foreground">
                    步骤 {index + 1}
                  </span>
                  <span className="font-semibold">{step.label}</span>
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

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
