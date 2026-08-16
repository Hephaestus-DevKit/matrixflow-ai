'use client';

import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  CheckCircle2,
  CircleAlert,
  CircleX,
  Cpu,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-store';
import { EmptyState, ErrorState, LoadingCards } from '@/components/ui/states';
import { PageHeader } from '@/components/ui/page';
import { useLocale, type Locale } from '@/lib/i18n';

type HealthCheck = {
  status: 'ok' | 'degraded' | 'failed';
  configured?: boolean;
  required?: boolean;
};

interface AdminHealth {
  status: 'ok' | 'degraded' | 'failed';
  service: string;
  release: string;
  checks: Record<string, HealthCheck>;
  ai: {
    ready: boolean;
    provider?: string;
    protocol?: string;
    model?: string;
    fallback?: boolean;
  };
  timestamp: string;
}

const COPY: Record<
  Locale,
  {
    eyebrow: string;
    title: string;
    description: string;
    denied: string;
    deniedDescription: string;
    diagnosticsDescription: string;
    serviceHealth: string;
    aiHealth: string;
    release: string;
    lastChecked: string;
    refresh: string;
    configured: string;
    notConfigured: string;
    provider: string;
    protocol: string;
    model: string;
    fallback: string;
    checks: Record<string, string>;
    status: { ok: string; degraded: string; failed: string };
    loadFailed: string;
  }
> = {
  'zh-CN': {
    eyebrow: '安全管理',
    title: '团队管理后台',
    description: '管理能力将只通过服务端角色校验与不可修改审计日志开放。',
    denied: '当前角色无权访问管理模块',
    deniedDescription: '请联系团队所有者或管理员调整成员角色。',
    diagnosticsDescription: '仅展示不含密钥的运行状态，帮助管理员在发布后快速确认服务健康度。',
    serviceHealth: '核心服务健康度',
    aiHealth: 'AI 协议状态',
    release: '发布版本',
    lastChecked: '最近检查',
    refresh: '重新检查',
    configured: '已配置',
    notConfigured: '未配置',
    provider: '主服务商',
    protocol: '协议',
    model: '模型',
    fallback: '已启用故障转移',
    checks: {
      function: '核心函数',
      provider: 'AI 服务',
      asyncWorker: '异步执行器',
      billing: '计费服务',
    },
    status: { ok: '正常', degraded: '待配置', failed: '异常' },
    loadFailed: '无法读取管理健康状态，请稍后重试。',
  },
  'zh-TW': {
    eyebrow: '安全管理',
    title: '團隊管理後台',
    description: '管理能力只會透過伺服器角色驗證與不可修改的稽核記錄開放。',
    denied: '目前角色無權存取管理模組',
    deniedDescription: '請聯絡團隊擁有者或管理員調整成員角色。',
    diagnosticsDescription: '只顯示不含密鑰的執行狀態，協助管理員在發布後快速確認服務健康度。',
    serviceHealth: '核心服務健康度',
    aiHealth: 'AI 協議狀態',
    release: '發布版本',
    lastChecked: '最近檢查',
    refresh: '重新檢查',
    configured: '已設定',
    notConfigured: '未設定',
    provider: '主要服務商',
    protocol: '協議',
    model: '模型',
    fallback: '已啟用故障轉移',
    checks: {
      function: '核心函數',
      provider: 'AI 服務',
      asyncWorker: '非同步執行器',
      billing: '計費服務',
    },
    status: { ok: '正常', degraded: '待設定', failed: '異常' },
    loadFailed: '無法讀取管理健康狀態，請稍後再試。',
  },
  en: {
    eyebrow: 'Security admin',
    title: 'Team administration',
    description:
      'Administrative capabilities open only behind server-side role checks and immutable audit logs.',
    denied: 'Your role cannot access administration',
    deniedDescription: 'Ask the team owner or an administrator to adjust your role.',
    diagnosticsDescription:
      'Only non-secret runtime state is shown so administrators can verify service health after a release.',
    serviceHealth: 'Core service health',
    aiHealth: 'AI protocol status',
    release: 'Release',
    lastChecked: 'Last checked',
    refresh: 'Check again',
    configured: 'Configured',
    notConfigured: 'Not configured',
    provider: 'Primary provider',
    protocol: 'Protocol',
    model: 'Model',
    fallback: 'Failover enabled',
    checks: {
      function: 'Core Function',
      provider: 'AI provider',
      asyncWorker: 'Async worker',
      billing: 'Billing',
    },
    status: { ok: 'Healthy', degraded: 'Needs setup', failed: 'Failing' },
    loadFailed: 'The admin health status could not be loaded. Try again shortly.',
  },
};

function statusIcon(status: HealthCheck['status']) {
  if (status === 'ok') return CheckCircle2;
  if (status === 'failed') return CircleX;
  return CircleAlert;
}

function statusClass(status: HealthCheck['status']) {
  if (status === 'ok') return 'text-emerald-500';
  if (status === 'failed') return 'text-destructive';
  return 'text-amber-500';
}

export default function AdminPage() {
  const { locale } = useLocale();
  const copy = COPY[locale];
  const { hasPerm } = useAuth();
  const allowed = hasPerm('admin.manage');
  const {
    data: health,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['admin-health'],
    queryFn: () => apiClient.get<AdminHealth>('/admin/health'),
    enabled: allowed,
    staleTime: 15_000,
  });

  return (
    <div className="space-y-6">
      <PageHeader eyebrow={copy.eyebrow} title={copy.title} description={copy.description} />
      {!allowed && (
        <EmptyState icon={ShieldCheck} title={copy.denied} description={copy.deniedDescription} />
      )}
      {allowed && (
        <>
          <div className="surface-card flex items-start gap-3 p-5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <ShieldCheck className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <h2 className="font-semibold text-foreground">{copy.serviceHealth}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{copy.diagnosticsDescription}</p>
            </div>
          </div>
          {isLoading && <LoadingCards count={2} />}
          {isError && <ErrorState onRetry={() => void refetch()} />}
          {health && !isError && (
            <div className="grid gap-4 lg:grid-cols-2">
              <section className="surface-card p-5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-primary" aria-hidden="true" />
                    <h2 className="font-semibold text-foreground">{copy.serviceHealth}</h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => void refetch()}
                    className="inline-flex h-9 items-center gap-2 rounded-lg border border-border px-3 text-xs font-semibold text-muted-foreground transition hover:border-primary/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                    {copy.refresh}
                  </button>
                </div>
                <div className="mt-4 space-y-2">
                  {Object.entries(health.checks).map(([key, check]) => {
                    const Icon = statusIcon(check.status);
                    return (
                      <div
                        key={key}
                        className="flex items-center justify-between gap-3 rounded-lg bg-muted/35 px-3 py-2.5 text-sm"
                      >
                        <span className="text-muted-foreground">{copy.checks[key] ?? key}</span>
                        <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
                          <Icon
                            className={`h-4 w-4 ${statusClass(check.status)}`}
                            aria-hidden="true"
                          />
                          {copy.status[check.status]}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-muted-foreground">{copy.release}</dt>
                    <dd className="mt-1 truncate font-mono text-xs text-foreground">
                      {health.release}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">{copy.lastChecked}</dt>
                    <dd className="mt-1 text-foreground">
                      {new Date(health.timestamp).toLocaleString(locale)}
                    </dd>
                  </div>
                </dl>
              </section>
              <section className="surface-card p-5">
                <div className="flex items-center gap-2">
                  <Cpu className="h-4 w-4 text-primary" aria-hidden="true" />
                  <h2 className="font-semibold text-foreground">{copy.aiHealth}</h2>
                </div>
                <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                  <div className="rounded-lg bg-muted/35 px-3 py-2.5">
                    <p className="text-muted-foreground">{copy.provider}</p>
                    <p className="mt-1 font-medium text-foreground">
                      {health.ai.provider || copy.notConfigured}
                    </p>
                  </div>
                  <div className="rounded-lg bg-muted/35 px-3 py-2.5">
                    <p className="text-muted-foreground">{copy.protocol}</p>
                    <p className="mt-1 font-medium text-foreground">
                      {health.ai.protocol || copy.notConfigured}
                    </p>
                  </div>
                  <div className="rounded-lg bg-muted/35 px-3 py-2.5">
                    <p className="text-muted-foreground">{copy.model}</p>
                    <p className="mt-1 truncate font-medium text-foreground">
                      {health.ai.model || copy.notConfigured}
                    </p>
                  </div>
                  <div className="rounded-lg bg-muted/35 px-3 py-2.5">
                    <p className="text-muted-foreground">{copy.fallback}</p>
                    <p className="mt-1 font-medium text-foreground">
                      {health.ai.fallback ? copy.configured : copy.notConfigured}
                    </p>
                  </div>
                </div>
              </section>
            </div>
          )}
          {isError && <p className="text-sm text-muted-foreground">{copy.loadFailed}</p>}
        </>
      )}
    </div>
  );
}
