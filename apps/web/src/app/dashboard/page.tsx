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
  type LucideIcon,
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
import { useLocale, type MessageKey } from '@/lib/i18n';

const QUICK_ACTIONS = [
  {
    href: '/dashboard/content',
    icon: Factory,
    title: 'dashboard.quick.content',
    description: 'dashboard.quick.contentDescription',
  },
  {
    href: '/dashboard/agents/new',
    icon: Bot,
    title: 'dashboard.quick.agent',
    description: 'dashboard.quick.agentDescription',
  },
  {
    href: '/dashboard/workflows/new',
    icon: GitFork,
    title: 'dashboard.quick.workflow',
    description: 'dashboard.quick.workflowDescription',
  },
] satisfies Array<{
  href: '/dashboard/content' | '/dashboard/agents/new' | '/dashboard/workflows/new';
  icon: LucideIcon;
  title: MessageKey;
  description: MessageKey;
}>;

export default function DashboardPage() {
  const { user } = useAuth();
  const { t } = useLocale();
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
        ai: { ready: boolean; provider?: string; protocol?: string; model?: string };
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
    {
      label: t('dashboard.connectAI'),
      done: Boolean(health.data?.ai.ready),
      href: '/dashboard/settings',
    },
    {
      label: t('dashboard.createKnowledge'),
      done: Boolean(knowledge.data?.length),
      href: '/dashboard/knowledge/new',
    },
    {
      label: t('dashboard.createAgent'),
      done: Boolean(agents.data?.length),
      href: '/dashboard/agents/new',
    },
    {
      label: t('dashboard.createProject'),
      done: Boolean(projects.data?.length),
      href: '/dashboard/content',
    },
  ] as const;
  const onboardingComplete = onboarding.every((step) => step.done);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={t('dashboard.eyebrow')}
        title={
          <>
            {t('dashboard.welcome')}，{user?.name || t('dashboard.group.workspace')}
          </>
        }
        description={t('dashboard.description')}
        actions={
          <Link
            href="/dashboard/agents/new"
            className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary transition hover:bg-primary/15"
          >
            <Sparkles className="h-3.5 w-3.5" /> {t('dashboard.deployAgent')}
          </Link>
        }
      />

      {health.data && (
        <section
          className={`flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between ${
            health.data.ai.ready
              ? 'border-success/20 bg-success/[0.06]'
              : 'border-warning/20 bg-warning/[0.07]'
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
                {health.data.ai.ready ? t('dashboard.aiReady') : t('dashboard.aiPending')}
              </p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {health.data.ai.ready
                  ? `${health.data.ai.provider} · ${health.data.ai.protocol || t('dashboard.unifiedProtocol')} · ${health.data.ai.model} · ${health.data.limits.monthlyAiCalls} ${t('dashboard.monthlyQuota')}`
                  : t('dashboard.aiPendingDescription')}
              </p>
            </div>
          </div>
        </section>
      )}

      {!isLoading && !onboardingComplete && (
        <section className="surface-card p-5 sm:p-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-base font-bold">{t('dashboard.onboardingTitle')}</h2>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {t('dashboard.onboardingDescription')}
              </p>
            </div>
            <span className="text-xs font-semibold text-muted-foreground">
              {onboarding.filter((step) => step.done).length} / {onboarding.length}{' '}
              {t('dashboard.onboardingDone')}
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
                    {t('dashboard.step')} {index + 1}
                  </span>
                  <span className="font-semibold">{step.label}</span>
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {hasError ? (
        <ErrorState message={t('dashboard.metricsError')} onRetry={retry} />
      ) : isLoading ? (
        <LoadingCards count={4} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label={t('dashboard.activeAgents')}
            value={activeAgents}
            detail={`${agents.data?.length ?? 0} ${t('dashboard.roles')}`}
            icon={Bot}
          />
          <StatCard
            label={t('dashboard.contentProjects')}
            value={projects.data?.length ?? 0}
            detail={t('dashboard.contentProjectDetail')}
            icon={Factory}
            tone="success"
          />
          <StatCard
            label={t('dashboard.aiCalls')}
            value={aiCalls.toLocaleString()}
            detail={t('dashboard.currentOrganization')}
            icon={Zap}
            tone="warning"
          />
          <StatCard
            label={t('dashboard.knowledgeBases')}
            value={knowledge.data?.length ?? 0}
            detail={t('dashboard.knowledgeDetail')}
            icon={FolderOpen}
            tone="info"
          />
        </div>
      )}

      <section className="space-y-4">
        <SectionHeading
          title={t('dashboard.quickActions')}
          description={t('dashboard.quickActionsDescription')}
        />
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
                  {t(action.title)}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </span>
                <span className="mt-2 block text-xs leading-5 text-muted-foreground">
                  {t(action.description)}
                </span>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
