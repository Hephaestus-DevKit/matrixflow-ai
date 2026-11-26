import { randomUUID, timingSafeEqual } from 'node:crypto';
import { ExecutionMethod, Query } from 'node-appwrite';
import { translateBatchField } from './content-delivery.js';
import {
  askKnowledgeBase,
  generateContent,
  generateAllContent,
  indexDocument,
  runAgent,
  runWorkflow,
} from './features.js';
import {
  DATABASE_ID,
  HttpError,
  TABLES,
  createRow,
  decodeRow,
  encodeData,
  getOwned,
} from './runtime.js';

const FUNCTION_ID = process.env.APPWRITE_FUNCTION_ID || 'matrixflow-core';
const MAX_PAYLOAD_BYTES = 100 * 1024;
const RETRYABLE_CODES = new Set([
  'AI_PROVIDER_ERROR',
  'AI_PROVIDER_RATE_LIMITED',
  'AI_NETWORK_ERROR',
  'AI_TIMEOUT',
  'APPWRITE_ERROR',
  'INTERNAL_ERROR',
]);
const DEFAULT_JOB_LEASE_MS = 90_000;
const DEFAULT_HEARTBEAT_INTERVAL_MS = 15_000;
const PENDING_STATUSES = new Set(['QUEUED', 'RETRY_WAIT']);
const TERMINAL_STATUSES = new Set(['SUCCEEDED', 'FAILED', 'CANCELED']);
const RELEASED_LEASE = { leaseExpiresAt: new Date(0).toISOString(), leaseToken: '' };

function workerSecret() {
  const value = String(process.env.MATRIXFLOW_WORKER_SECRET || '').trim();
  if (!value || value.length < 32)
    throw new HttpError('异步执行器尚未配置安全密钥', 503, 'ASYNC_WORKER_NOT_CONFIGURED');
  return value;
}

function boundedInteger(value, fallback, minimum, maximum) {
  if (value == null || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, Math.round(parsed)));
}

function jobLeaseMs(env = process.env) {
  return boundedInteger(env.MATRIXFLOW_JOB_LEASE_MS, DEFAULT_JOB_LEASE_MS, 30_000, 110_000);
}

function heartbeatIntervalMs(env = process.env) {
  return boundedInteger(
    env.MATRIXFLOW_JOB_HEARTBEAT_MS,
    DEFAULT_HEARTBEAT_INTERVAL_MS,
    5_000,
    Math.floor(jobLeaseMs(env) / 2),
  );
}

function nextLeaseExpiry(now) {
  return new Date(now + jobLeaseMs()).toISOString();
}

function publicJob(job) {
  let errorCode = 'BACKEND_ERROR';
  try {
    errorCode = JSON.parse(job.error || '{}').code || errorCode;
  } catch {
    /* legacy plain text */
  }
  return {
    id: job.id,
    type: job.type,
    status: job.status,
    attempts: Number(job.attempts || 0),
    maxAttempts: Number(job.maxAttempts || 3),
    runAfter: job.runAfter,
    startedAt: job.startedAt || null,
    heartbeatAt: job.heartbeatAt || null,
    completedAt: job.completedAt || null,
    error: job.error ? { code: errorCode } : null,
    result: job.status === 'SUCCEEDED' ? job.result || {} : undefined,
    ...(job.type === 'content.translate-batch' && {
      progress: {
        processed: job.result?.cursor ?? 0,
        total: job.payload?.items?.length ?? 0,
      },
    }),
    cancelRequested: Boolean(job.cancelRequested),
    resourceHref:
      job.type === 'agent.run' && job.payload?.agentId
        ? `/dashboard/agents/${encodeURIComponent(job.payload.agentId)}`
        : job.type === 'workflow.run' && job.payload?.workflowId
          ? `/dashboard/workflows/${encodeURIComponent(job.payload.workflowId)}/runs`
          : job.type === 'content.translate-batch' && job.payload?.projectId
            ? `/dashboard/content?project=${encodeURIComponent(job.payload.projectId)}&view=translations&translationJob=${encodeURIComponent(job.id)}`
            : ['content.generate', 'content.generate-all'].includes(job.type) &&
                job.payload?.projectId
              ? `/dashboard/content?project=${encodeURIComponent(job.payload.projectId)}`
              : job.type === 'knowledge.ask' && job.payload?.knowledgeBaseId
                ? `/dashboard/knowledge/${encodeURIComponent(job.payload.knowledgeBaseId)}`
                : job.type === 'knowledge.index'
                  ? '/dashboard/knowledge'
                  : undefined,
  };
}

function publicJobSummary(job) {
  const summary = publicJob(job);
  delete summary.error;
  delete summary.result;
  delete summary.resourceHref;
  return summary;
}

async function dispatchJob(services, job, scheduledAt) {
  const secret = workerSecret();
  if (!services.functions?.createExecution)
    throw new HttpError('Appwrite 异步执行服务不可用', 503, 'ASYNC_WORKER_NOT_CONFIGURED');
  const body = JSON.stringify({
    jobId: job.id,
    organizationId: job.organizationId,
  });
  return services.functions.createExecution({
    functionId: FUNCTION_ID,
    body,
    async: true,
    xpath: '/internal/jobs/execute',
    method: ExecutionMethod.POST,
    headers: {
      'content-type': 'application/json',
      'x-matrixflow-worker-secret': secret,
    },
    ...(scheduledAt ? { scheduledAt } : {}),
  });
}

/**
 * Claim a job with a conditional transaction.
 *
 * A read followed by updateRow is not sufficient here: Appwrite may deliver
 * the same async execution more than once. The status/lease predicates make
 * only one invocation the owner of the job. A stale RUNNING lease can be
 * reclaimed after a worker crash, while a live worker is left untouched.
 */
export async function claimJob(services, job, now = Date.now(), requestId = '') {
  const { status } = job;
  const attempt = Number(job.attempts || 0) + 1;
  const canClaim = (current) =>
    current.status === status &&
    Number(current.attempts || 0) === attempt - 1 &&
    attempt <= Number(current.maxAttempts || 3) &&
    !isCanceled(current) &&
    (status === 'RUNNING'
      ? leaseExpiry(current) <= now
      : PENDING_STATUSES.has(status) && Date.parse(current.runAfter) <= now);
  if (!canClaim(job)) return null;
  const timestamp = new Date(now).toISOString();
  return updateJob(services, job, canClaim, {
    status: 'RUNNING',
    attempts: attempt,
    startedAt: job.startedAt || timestamp,
    heartbeatAt: timestamp,
    leaseExpiresAt: nextLeaseExpiry(now),
    leaseToken: `${(requestId || 'worker').slice(0, 27)}-${randomUUID()}`,
    error: '',
  });
}

function leaseExpiry(job) {
  if (job.leaseExpiresAt) return Date.parse(job.leaseExpiresAt);
  return Date.parse(job.heartbeatAt || job.startedAt || job.runAfter) + jobLeaseMs();
}

async function updateJob(services, job, matches, data) {
  const table = {
    databaseId: DATABASE_ID,
    tableId: TABLES.backgroundJobs,
  };
  const changes = encodeData(data);
  // Stage a single-row write before checking the predicates. The read checks
  // the committed row, then Appwrite checks for conflicts at commit.
  const tables = services.tables;
  const { $id: transactionId } = await tables.createTransaction();
  let committed = false;
  try {
    await tables.updateRow({ ...table, rowId: job.id, transactionId, data: changes });
    const { rows } = await tables.listRows({
      ...table,
      queries: [
        Query.equal('$id', job.id),
        Query.equal('organizationId', job.organizationId),
        Query.limit(1),
      ],
      total: false,
      ttl: 0,
    });
    if (!rows.length || !matches(decodeRow(rows[0]))) return null;
    try {
      await tables.updateTransaction({ transactionId, commit: true });
    } catch (error) {
      if (Number(error?.code) === 409) return null;
      const transaction = await tables.getTransaction({ transactionId }).catch(() => null);
      if (transaction?.status !== 'committed') throw error;
    }
    committed = true;
    return decodeRow({ ...rows[0], ...changes });
  } finally {
    if (!committed) {
      await tables.updateTransaction({ transactionId, rollback: true }).catch(() => undefined);
    }
  }
}

function updateWithLease(services, job, data, matches = () => true) {
  return updateJob(
    services,
    job,
    (current) =>
      current.status === 'RUNNING' && current.leaseToken === job.leaseToken && matches(current),
    data,
  );
}

function readJob(services, job) {
  return getOwned(services, TABLES.backgroundJobs, job.id, job.organizationId);
}

function samePendingDispatch(job, current) {
  return (
    current.status === job.status &&
    current.attempts === job.attempts &&
    current.result?.cursor === job.result?.cursor &&
    Date.parse(current.runAfter) === Date.parse(job.runAfter) &&
    (Date.parse(current.leaseExpiresAt) || 0) === (Date.parse(job.leaseExpiresAt) || 0) &&
    isCanceled(current) === isCanceled(job)
  );
}

function isPermanentDispatchError(error) {
  const status = Number(error?.status || error?.code);
  return (
    error?.code === 'ASYNC_WORKER_NOT_CONFIGURED' ||
    (status >= 400 && status < 500 && ![408, 409, 425, 429].includes(status))
  );
}

async function sendPersistedJob(services, job, scheduledAt) {
  try {
    await dispatchJob(services, job, scheduledAt);
    return { job };
  } catch (error) {
    // An execution can already exist when its response is lost. Keep the row
    // eligible for execution and let task reads re-dispatch if it stays pending.
    if (isPermanentDispatchError(error)) {
      const failed = await updateJob(
        services,
        job,
        (current) => samePendingDispatch(job, current),
        {
          ...RELEASED_LEASE,
          status: 'FAILED',
          error: JSON.stringify({
            code: error?.code === 'ASYNC_WORKER_NOT_CONFIGURED' ? error.code : 'BACKEND_ERROR',
          }),
          completedAt: new Date().toISOString(),
        },
      );
      if (failed) return { job: failed, error };
    }
    return { job: await readJob(services, job).catch(() => job) };
  }
}

async function finishRun(services, job, outcome) {
  const now = new Date().toISOString();
  let current = job;
  for (let attempt = 0; attempt < 3; attempt++) {
    const canceled = isCanceled(current);
    const completed = await updateWithLease(
      services,
      job,
      {
        ...RELEASED_LEASE,
        heartbeatAt: now,
        ...(canceled ? { status: 'CANCELED', result: {}, completedAt: now } : outcome),
      },
      (latest) => isCanceled(latest) === canceled,
    );
    if (completed) return completed;
    current = await readJob(services, job);
    if (current.status !== 'RUNNING' || current.leaseToken !== job.leaseToken) return null;
  }
  throw new HttpError('后台任务状态已变更，请刷新后重试', 409, 'CONFLICT');
}

export async function enqueueJob(services, context, type, payload, options = {}) {
  if (
    ![
      'agent.run',
      'workflow.run',
      'content.generate',
      'content.generate-all',
      'content.translate-batch',
      'knowledge.index',
      'knowledge.ask',
    ].includes(type)
  )
    throw new HttpError('不支持的后台任务类型', 400, 'JOB_TYPE_INVALID');
  const serialized = JSON.stringify(payload || {});
  if (Buffer.byteLength(serialized, 'utf8') > MAX_PAYLOAD_BYTES)
    throw new HttpError('后台任务参数过大', 413, 'JOB_PAYLOAD_TOO_LARGE');
  const now = Date.now();
  const job = await createRow(services, TABLES.backgroundJobs, context.teamId, {
    type,
    status: 'QUEUED',
    payload,
    result: {},
    error: '',
    attempts: 0,
    maxAttempts: boundedInteger(options.maxAttempts, 3, 1, 10),
    runAfter: new Date(now).toISOString(),
    leaseExpiresAt: nextLeaseExpiry(now),
    cancelRequested: false,
    createdBy: context.userId,
  });
  const dispatched = await sendPersistedJob(services, job);
  if (dispatched.error) throw dispatched.error;
  return publicJob(dispatched.job);
}

async function runPayload(services, job, context) {
  const payload = job.payload && typeof job.payload === 'object' ? job.payload : {};
  if (job.type === 'agent.run') return runAgent(services, context, payload);
  if (job.type === 'workflow.run') return runWorkflow(services, context, payload);
  if (job.type === 'content.generate') return generateContent(services, context, payload);
  if (job.type === 'knowledge.ask') return askKnowledgeBase(services, context, payload);
  if (job.type === 'content.generate-all') return generateAllContent(services, context, payload);
  if (job.type === 'knowledge.index') return indexDocument(services, context, payload);
  throw new HttpError('后台任务类型不存在', 400, 'JOB_TYPE_INVALID');
}

async function translationBatchStep(services, job, context) {
  const { items } = job.payload;
  const previous = job.result ?? {};
  const cursor = previous.cursor ?? 0;
  const result = {
    cursor: cursor + 1,
    completed: previous.completed ?? 0,
    skipped: previous.skipped ?? 0,
    failed: previous.failed ?? 0,
    errors: previous.errors ?? [],
  };
  try {
    if (
      await translateBatchField(services, context, { ...job.payload, jobId: job.id }, items[cursor])
    )
      result.completed++;
    else result.skipped++;
  } catch (error) {
    if (canRetry(error, job)) throw error;
    if (error?.code === 'REVIEW_CONFLICT') result.skipped++;
    else {
      result.failed++;
      result.errors = [
        ...result.errors,
        { id: items[cursor].id, code: error?.code || 'BACKEND_ERROR' },
      ];
    }
  }
  const now = new Date().toISOString();
  return result.cursor === items.length
    ? { status: 'SUCCEEDED', result, completedAt: now }
    : {
        status: 'QUEUED',
        result,
        attempts: 0,
        runAfter: now,
        leaseExpiresAt: nextLeaseExpiry(Date.now()),
      };
}

function isCanceled(job) {
  return job.status === 'CANCELED' || Boolean(job.cancelRequested);
}

function canRetry(error, job) {
  return (
    Number(job.attempts || 0) < Number(job.maxAttempts || 3) && RETRYABLE_CODES.has(error?.code)
  );
}

function maintainLease(services, job) {
  let renewal;
  const heartbeat = setInterval(() => {
    if (renewal) return;
    const now = Date.now();
    renewal = updateWithLease(services, job, {
      heartbeatAt: new Date(now).toISOString(),
      leaseExpiresAt: nextLeaseExpiry(now),
    })
      .catch(() => {
        // A transient failure leaves recovery available when the lease expires.
      })
      .finally(() => {
        renewal = undefined;
      });
  }, heartbeatIntervalMs());
  heartbeat.unref?.();
  // An in-flight renewal cannot overwrite a settlement: both changes check
  // the lease in a transaction. Let settlement proceed if that request stalls.
  return () => clearInterval(heartbeat);
}

export async function executeJob(services, { jobId, organizationId, requestId }) {
  if (!jobId || !organizationId)
    throw new HttpError('后台任务上下文不完整', 400, 'JOB_CONTEXT_INVALID');
  const job = await getOwned(services, TABLES.backgroundJobs, jobId, organizationId);
  if (TERMINAL_STATUSES.has(job.status)) return publicJob(job);
  const now = Date.now();
  if (job.status === 'RUNNING') {
    if (leaseExpiry(job) > now) return publicJob(job);
    if (isCanceled(job) || Number(job.attempts) >= Number(job.maxAttempts || 3)) {
      return publicJob(await recoverStaleJob(services, job, now));
    }
  }
  if (PENDING_STATUSES.has(job.status)) {
    if (isCanceled(job)) return publicJob(await recoverIncompleteJob(services, job, now));
    if (Date.parse(job.runAfter) > now) return publicJob(job);
  }
  const running = await claimJob(services, job, now, requestId);
  if (!running) return publicJob(await readJob(services, job));

  const stopHeartbeat = maintainLease(services, running);
  const context = {
    teamId: organizationId,
    userId: job.createdBy,
    requestId: requestId || `job-${job.id}`,
  };
  const outcome = await (
    job.type === 'content.translate-batch'
      ? translationBatchStep(services, running, context)
      : runPayload(services, running, context).then((result) => ({
          status: 'SUCCEEDED',
          result,
          completedAt: new Date().toISOString(),
        }))
  )
    .catch((error) => {
      const retry = canRetry(error, running);
      const delay = Math.min(15 * 60_000, 30_000 * 2 ** (running.attempts - 1));
      const nextRun = Math.ceil((Date.now() + delay) / 60_000) * 60_000;
      return {
        status: retry ? 'RETRY_WAIT' : 'FAILED',
        error: JSON.stringify({ code: error?.code || 'BACKEND_ERROR' }),
        runAfter: retry ? new Date(nextRun).toISOString() : undefined,
        leaseExpiresAt: retry ? nextLeaseExpiry(nextRun) : RELEASED_LEASE.leaseExpiresAt,
        completedAt: retry ? undefined : new Date().toISOString(),
      };
    })
    .finally(stopHeartbeat);

  const finished = await finishRun(services, running, outcome);
  if (!finished) return publicJob(await readJob(services, job));
  if (finished.status === 'RETRY_WAIT') {
    return publicJob((await sendPersistedJob(services, finished, finished.runAfter)).job);
  }
  if (finished.status === 'QUEUED')
    return publicJob((await sendPersistedJob(services, finished)).job);
  return publicJob(finished);
}

// A crashed Appwrite execution may never be delivered again. Task-center reads
// recover expired leases atomically so users do not see a permanent RUNNING job.
export async function recoverStaleJob(services, job, now = Date.now()) {
  if (job.status !== 'RUNNING' || !(leaseExpiry(job) <= now)) return job;
  const exhausted = Number(job.attempts || 0) >= Number(job.maxAttempts || 3);
  const canceled = isCanceled(job);
  const status = canceled ? 'CANCELED' : exhausted ? 'FAILED' : 'RETRY_WAIT';
  const recovered = await updateJob(
    services,
    job,
    (current) =>
      current.status === 'RUNNING' &&
      current.attempts === job.attempts &&
      current.maxAttempts === job.maxAttempts &&
      current.leaseToken === job.leaseToken &&
      isCanceled(current) === canceled &&
      leaseExpiry(current) <= now,
    {
      ...RELEASED_LEASE,
      status,
      error: canceled ? undefined : JSON.stringify({ code: 'JOB_WORKER_TIMEOUT' }),
      runAfter: new Date(now).toISOString(),
      completedAt: status === 'RETRY_WAIT' ? undefined : new Date(now).toISOString(),
      leaseExpiresAt:
        status === 'RETRY_WAIT' ? nextLeaseExpiry(now) : RELEASED_LEASE.leaseExpiresAt,
    },
  );
  if (!recovered) return readJob(services, job);
  if (status === 'RETRY_WAIT') return (await sendPersistedJob(services, recovered)).job;
  return recovered;
}

async function recoverIncompleteJob(services, job, now = Date.now()) {
  if (job.status === 'RUNNING') return recoverStaleJob(services, job, now);
  if (!PENDING_STATUSES.has(job.status)) return job;

  const matches = (current) => samePendingDispatch(job, current);
  if (isCanceled(job)) {
    const canceled = await updateJob(services, job, matches, {
      ...RELEASED_LEASE,
      status: 'CANCELED',
      completedAt: new Date(now).toISOString(),
    });
    return canceled || readJob(services, job);
  }
  const runAfter = Date.parse(job.runAfter);
  // Older rows either have no lease or released their worker lease on retry.
  const recoverAt = Math.max(Date.parse(job.leaseExpiresAt) || 0, runAfter + jobLeaseMs());
  if (!(recoverAt <= now)) return job;
  const reserved = await updateJob(services, job, matches, {
    leaseExpiresAt: nextLeaseExpiry(now),
  });
  if (!reserved) return readJob(services, job);
  return (await sendPersistedJob(services, reserved)).job;
}

export async function getJob(services, teamId, jobId) {
  return publicJob(
    await recoverIncompleteJob(
      services,
      await getOwned(services, TABLES.backgroundJobs, jobId, teamId),
    ),
  );
}

export async function listJobs(services, teamId, options = {}) {
  const paged = Object.hasOwn(options, 'limit') || Object.hasOwn(options, 'offset');
  const requestedLimit = Number(options.limit);
  const requestedOffset = Number(options.offset);
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(100, Math.max(1, Math.floor(requestedLimit)))
    : 25;
  const offset = Number.isFinite(requestedOffset)
    ? Math.min(10_000_000, Math.max(0, Math.floor(requestedOffset)))
    : 0;
  const result = await services.tables.listRows({
    databaseId: DATABASE_ID,
    tableId: TABLES.backgroundJobs,
    queries: [
      Query.equal('organizationId', teamId),
      Query.orderDesc('$createdAt'),
      Query.limit(limit),
      Query.offset(offset),
    ],
  });
  const data = await Promise.all(
    result.rows.map(async (row) =>
      publicJobSummary(await recoverIncompleteJob(services, decodeRow(row))),
    ),
  );
  const total = Number(result.total || 0);
  const page = {
    data,
    total,
    limit,
    offset,
    nextOffset: offset + data.length < total ? offset + data.length : null,
  };
  return paged ? page : data;
}

export async function cancelJob(services, context, jobId, reason = '') {
  let job = await getOwned(services, TABLES.backgroundJobs, jobId, context.teamId);
  for (let attempt = 0; attempt < 3; attempt++) {
    if (TERMINAL_STATUSES.has(job.status) || job.cancelRequested) return publicJob(job);
    const running = job.status === 'RUNNING';
    const updated = await updateJob(
      services,
      job,
      (current) => current.status === job.status && !isCanceled(current),
      {
        ...(running ? {} : RELEASED_LEASE),
        status: running ? 'RUNNING' : 'CANCELED',
        cancelRequested: true,
        error: reason ? `取消原因：${reason}`.slice(0, 1_000) : '用户请求取消',
        completedAt: running ? undefined : new Date().toISOString(),
      },
    );
    if (updated) return publicJob(updated);
    job = await readJob(services, job);
  }
  if (TERMINAL_STATUSES.has(job.status) || job.cancelRequested) return publicJob(job);
  throw new HttpError('后台任务状态已变更，请刷新后重试', 409, 'CONFLICT');
}

export function verifyWorkerRequest(headers) {
  const expected = workerSecret();
  const provided = String(headers?.['x-matrixflow-worker-secret'] || '');
  const actual = Buffer.from(provided, 'utf8');
  const wanted = Buffer.from(expected, 'utf8');
  if (!provided || actual.length !== wanted.length || !timingSafeEqual(actual, wanted))
    throw new HttpError('后台任务凭证无效', 401, 'JOB_WORKER_UNAUTHORIZED');
}
