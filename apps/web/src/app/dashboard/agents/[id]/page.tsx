'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Bot, ArrowLeft, Loader2, Sparkles, Cpu, Clock, DollarSign, Zap } from 'lucide-react';
import type { AgentSummary } from '@matrixflow/shared';
import { toast } from 'sonner';
import { errorMessage } from '@/lib/errors';
import { useLocale, type Locale } from '@/lib/i18n';

const COPY: Record<
  Locale,
  {
    completed: string;
    runDone: string;
    runFailed: string;
    loading: string;
    missing: string;
    missingDescription: string;
    back: string;
    running: string;
    draft: string;
    archived: string;
    config: string;
    model: string;
    orgId: string;
    deployed: string;
    skills: string;
    noSkills: string;
    runTitle: string;
    runDescription: string;
    taskLabel: string;
    placeholder: string;
    runningNow: string;
    start: string;
    notReady: string;
    persona: string;
    noPersona: string;
    history: string;
    noHistory: string;
    consumed: string;
    cost: string;
    success: string;
    failed: string;
  }
> = {
  'zh-CN': {
    completed: '运行已完成',
    runDone: 'AI 员工运行完成',
    runFailed: 'AI 员工运行失败',
    loading: '加载中…',
    missing: '未找到该 AI 员工',
    missingDescription: '该员工可能已被删除，或您没有访问权限。',
    back: '返回员工列表',
    running: '运行中',
    draft: '草稿',
    archived: '已归档',
    config: '运行配置',
    model: '推理模型',
    orgId: '所属组织 ID',
    deployed: '部署时间',
    skills: '掌握技能',
    noSkills: '暂未绑定任何专业领域技能。',
    runTitle: '运行 AI 员工',
    runDescription: '输入一项明确任务；运行会消耗团队 AI 额度并写入审计记录。',
    taskLabel: '运行任务',
    placeholder: '例如：根据产品资料写一段面向美国市场的广告文案。',
    runningNow: '运行中…',
    start: '开始运行',
    notReady: 'AI 服务未就绪',
    persona: '岗位人设（System Instructions）',
    noPersona: '未配置详细人设。',
    history: '最近调用明细',
    noHistory: '暂无调用运行记录。一旦工作流或内容工厂触发该角色，记录将自动在此汇总。',
    consumed: '消耗',
    cost: '计费金额',
    success: '成功',
    failed: '失败',
  },
  'zh-TW': {
    completed: '執行已完成',
    runDone: 'AI 員工執行完成',
    runFailed: 'AI 員工執行失敗',
    loading: '載入中…',
    missing: '找不到該 AI 員工',
    missingDescription: '該員工可能已被刪除，或您沒有存取權限。',
    back: '返回員工列表',
    running: '執行中',
    draft: '草稿',
    archived: '已封存',
    config: '執行設定',
    model: '推理模型',
    orgId: '所屬組織 ID',
    deployed: '部署時間',
    skills: '掌握技能',
    noSkills: '尚未綁定任何專業領域技能。',
    runTitle: '執行 AI 員工',
    runDescription: '輸入一項明確任務；執行會消耗團隊 AI 額度並寫入稽核記錄。',
    taskLabel: '執行任務',
    placeholder: '例如：根據產品資料撰寫一段面向美國市場的廣告文案。',
    runningNow: '執行中…',
    start: '開始執行',
    notReady: 'AI 服務未就緒',
    persona: '職位人設（System Instructions）',
    noPersona: '尚未設定詳細人設。',
    history: '最近呼叫明細',
    noHistory: '暫無執行記錄。工作流或內容工廠觸發此角色後，記錄會自動彙總。',
    consumed: '消耗',
    cost: '計費金額',
    success: '成功',
    failed: '失敗',
  },
  en: {
    completed: 'Run completed',
    runDone: 'AI worker run completed',
    runFailed: 'AI worker run failed',
    loading: 'Loading…',
    missing: 'AI worker not found',
    missingDescription: 'This worker may have been deleted, or you may not have access.',
    back: 'Back to workers',
    running: 'Running',
    draft: 'Draft',
    archived: 'Archived',
    config: 'Run configuration',
    model: 'Reasoning model',
    orgId: 'Organization ID',
    deployed: 'Deployed',
    skills: 'Skills',
    noSkills: 'No domain skills are linked yet.',
    runTitle: 'Run AI worker',
    runDescription: 'Enter a clear task. Runs consume team AI quota and create an audit record.',
    taskLabel: 'Task to run',
    placeholder: 'e.g. Write an ad for the US market from the product material.',
    runningNow: 'Running…',
    start: 'Start run',
    notReady: 'AI service not ready',
    persona: 'Role persona (System Instructions)',
    noPersona: 'No detailed persona configured.',
    history: 'Recent run details',
    noHistory:
      'No runs yet. Records appear after a workflow or content factory triggers this role.',
    consumed: 'Consumed',
    cost: 'Cost',
    success: 'Success',
    failed: 'Failed',
  },
};

export default function AgentDetailPage() {
  const { locale } = useLocale();
  const copy = COPY[locale];
  const { id } = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [prompt, setPrompt] = useState('');
  const [latestOutput, setLatestOutput] = useState('');
  const { data: agent, isLoading } = useQuery({
    queryKey: ['agent', id],
    queryFn: () => apiClient.get<AgentSummary>(`/agents/${id}`),
    enabled: !!id,
  });
  const runMutation = useMutation({
    mutationFn: () =>
      apiClient.post<{ output?: { text?: string } }>(`/agents/${id}/run`, {
        input: { prompt: prompt.trim() },
      }),
    onSuccess: async (result) => {
      setLatestOutput(result.output?.text || copy.completed);
      setPrompt('');
      await queryClient.invalidateQueries({ queryKey: ['agent', id] });
      toast.success(copy.runDone);
    },
    onError: (error: unknown) => toast.error(errorMessage(error, copy.runFailed)),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12 text-muted-foreground text-sm gap-2 animate-fade-in">
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
        {copy.loading}
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="rounded-xl border border-dashed border-border/60 bg-muted/10 p-12 text-center flex flex-col items-center justify-center animate-fade-in">
        <Bot className="h-10 w-10 text-muted-foreground/60 mb-3" />
        <p className="text-sm font-semibold text-foreground">{copy.missing}</p>
        <p className="mt-1 text-xs text-muted-foreground max-w-[280px]">
          {copy.missingDescription}
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.push('/dashboard/agents')}
          className="mt-4 text-xs"
        >
          {copy.back}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border/40 pb-5">
        <button
          onClick={() => router.push('/dashboard/agents')}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/5 text-primary border border-primary/10">
            <Bot className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight">{agent.name}</h1>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                  agent.status === 'ACTIVE'
                    ? 'bg-success/5 border-success/15 text-success'
                    : 'bg-muted border-border text-muted-foreground'
                }`}
              >
                {agent.status === 'ACTIVE'
                  ? copy.running
                  : agent.status === 'DRAFT'
                    ? copy.draft
                    : copy.archived}
              </span>
            </div>
            <p className="mt-0.5 text-xs font-medium text-muted-foreground">{agent.role}</p>
          </div>
        </div>
      </div>

      {/* Main Details Grid */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Meta Stats Panel */}
        <div className="md:col-span-1 space-y-4">
          <div className="rounded-xl border border-border/60 bg-card p-5 shadow-sm space-y-4">
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 border-b border-border/40 pb-2">
              <Cpu className="h-3.5 w-3.5 text-primary" /> {copy.config}
            </h3>

            <div className="space-y-3">
              <div>
                <p className="text-[0.6875rem] font-semibold text-muted-foreground">{copy.model}</p>
                <p className="text-xs font-mono font-bold mt-0.5 text-foreground">
                  {agent.model ?? 'glm-4-flash'}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground">{copy.orgId}</p>
                <p className="text-xs font-mono mt-0.5 text-muted-foreground truncate">
                  {agent.organizationId}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground">{copy.deployed}</p>
                <p className="text-xs mt-0.5 text-foreground">
                  {new Date(agent.createdAt).toLocaleString(locale, { hour12: false })}
                </p>
              </div>
            </div>
          </div>

          {/* Skills panel */}
          <div className="rounded-xl border border-border/60 bg-card p-5 shadow-sm space-y-3">
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 border-b border-border/40 pb-2">
              <Zap className="h-3.5 w-3.5 text-primary" /> {copy.skills}
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {agent.skills?.map((s) => (
                <span
                  key={s.skillKey}
                  className="rounded-md bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground border border-border/50"
                >
                  {s.skillKey}
                </span>
              ))}
              {(!agent.skills || agent.skills.length === 0) && (
                <span className="text-xs text-muted-foreground">{copy.noSkills}</span>
              )}
            </div>
          </div>
        </div>

        {/* Prompt & Run History panel */}
        <div className="md:col-span-2 space-y-6">
          <section className="rounded-xl border border-primary/20 bg-primary/[0.04] p-5 shadow-sm">
            <h2 className="text-sm font-bold">{copy.runTitle}</h2>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">{copy.runDescription}</p>
            <label htmlFor="agent-run-prompt" className="sr-only">
              {copy.taskLabel}
            </label>
            <textarea
              id="agent-run-prompt"
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder={copy.placeholder}
              className="mt-4 min-h-28 w-full resize-y rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <div className="mt-3 flex justify-end">
              <Button
                onClick={() => runMutation.mutate()}
                disabled={runMutation.isPending || !prompt.trim() || agent.status !== 'ACTIVE'}
              >
                {runMutation.isPending
                  ? copy.runningNow
                  : agent.status === 'ACTIVE'
                    ? copy.start
                    : copy.notReady}
              </Button>
            </div>
            {latestOutput && (
              <div className="mt-4 rounded-xl border border-border bg-background/70 p-4 text-sm leading-6 whitespace-pre-wrap">
                {latestOutput}
              </div>
            )}
          </section>
          {/* Prompt Section */}
          <div className="rounded-xl border border-border/60 bg-card p-5 shadow-sm space-y-3">
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 border-b border-border/40 pb-2">
              <Sparkles className="h-3.5 w-3.5 text-primary" /> {copy.persona}
            </h3>
            <div className="bg-muted/30 border border-border/40 rounded-lg p-3 max-h-60 overflow-y-auto">
              <pre className="text-xs font-mono leading-relaxed whitespace-pre-wrap text-muted-foreground">
                {typeof agent.systemPrompt?.raw === 'string'
                  ? agent.systemPrompt.raw
                  : copy.noPersona}
              </pre>
            </div>
          </div>

          {/* Run History Section */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-primary" /> {copy.history}
            </h3>

            {(!agent.runs || agent.runs.length === 0) && (
              <div className="rounded-xl border border-dashed border-border/60 bg-muted/10 p-8 text-center text-xs text-muted-foreground">
                {copy.noHistory}
              </div>
            )}

            {agent.runs && agent.runs.length > 0 && (
              <div className="space-y-2">
                {agent.runs.slice(0, 10).map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between rounded-xl border border-border/60 bg-card p-4 transition-all hover:border-border/80"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-7 w-7 items-center justify-center rounded bg-muted font-mono text-[10px] text-muted-foreground border border-border/40">
                        RUN
                      </div>
                      <div>
                        <p className="font-mono text-2xs text-muted-foreground truncate max-w-[120px]">
                          {r.id}
                        </p>
                        <p className="text-[10px] text-muted-foreground font-medium mt-0.5">
                          {copy.consumed}:{' '}
                          <span className="text-foreground">{r.tokensUsed ?? 0} tokens</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-right">
                      <div>
                        <p className="text-xs font-bold text-foreground flex items-center gap-0.5 justify-end">
                          <DollarSign className="h-3 w-3 text-muted-foreground" />
                          {r.costUsd?.toFixed(4) ?? '0.0000'}
                        </p>
                        <p className="text-2xs text-muted-foreground mt-0.5">{copy.cost}</p>
                      </div>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          r.status === 'COMPLETED'
                            ? 'bg-success/5 border-success/15 text-success'
                            : r.status === 'FAILED'
                              ? 'bg-destructive/5 border-destructive/15 text-destructive'
                              : 'bg-muted border-border text-muted-foreground'
                        }`}
                      >
                        {r.status === 'COMPLETED'
                          ? copy.success
                          : r.status === 'FAILED'
                            ? copy.failed
                            : copy.running}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
