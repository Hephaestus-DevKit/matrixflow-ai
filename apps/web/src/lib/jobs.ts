export type JobStatus = 'QUEUED' | 'RUNNING' | 'RETRY_WAIT' | 'SUCCEEDED' | 'FAILED' | 'CANCELED';
export interface BackgroundJob {
  id: string;
  type: string;
  status: JobStatus;
  attempts: number;
  maxAttempts: number;
  runAfter?: string;
  startedAt?: string | null;
  completedAt?: string | null;
  cancelRequested?: boolean;
  error?: { code?: string } | string | null;
  result?: Record<string, unknown>;
  resourceHref?: string;
}
export function isActiveJob(job: Pick<BackgroundJob, 'status'> | undefined) {
  return !!job && ['QUEUED', 'RUNNING', 'RETRY_WAIT'].includes(job.status);
}
export function jobResultText(job: BackgroundJob): string {
  if (job.status !== 'SUCCEEDED' || !job.result) return '';
  const result = job.result;
  if (job.type === 'agent.run') return String((result.output as { text?: string })?.text || '');
  if (job.type === 'content.generate') return String(result.content || '');
  if (job.type === 'knowledge.ask') return String(result.answer || '');
  if (job.type === 'content.generate-all') {
    return (Array.isArray(result.results) ? result.results : [])
      .filter((entry) => entry.status === 'fulfilled')
      .map((entry) => `## ${entry.type}\n\n${entry.value?.content || ''}`)
      .join('\n\n');
  }
  if (job.type === 'workflow.run') {
    const output = result.output;
    return typeof output === 'string' ? output : JSON.stringify(output ?? {}, null, 2);
  }
  return '';
}
