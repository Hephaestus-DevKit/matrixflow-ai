import { randomUUID, timingSafeEqual } from 'node:crypto';
import { ExecutionMethod, Query } from 'node-appwrite';
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
const TERMINAL_STATUSES = new Set(['SUCCEEDED', 'FAILED', 'CANCELED']);

function workerSecret() {
  const value = String(process.env.MATRIXFLOW_WORKER_SECRET || '').trim();
  if (!value || value.length < 32)
    throw new HttpError('异步执行器尚未配置安全密钥', 503, 'ASYNC_WORKER_NOT_CONFIGURED');
  return value;
}

function boundedMilliseconds(value, fallback, minimum, maximum) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, Math.round(parsed)));
}

function jobLeaseMs(env = process.env) {
  return boundedMilliseconds(env.MATRIXFLOW_JOB_LEASE_MS, DEFAULT_JOB_LEASE_MS, 30_000, 110_000);
}

function heartbeatIntervalMs(env = process.env) {
  return boundedMilliseconds(
    env.MATRIXFLOW_JOB_HEARTBEAT_MS,
    DEFAULT_HEARTBEAT_INTERVAL_MS,
    5_000,
    Math.floor(jobLeaseMs(env) / 2),
  );
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
    cancelRequested: Boolean(job.cancelRequested),
    resourceHref:
      job.type === 'agent.run' && job.payload?.agentId
        ? `/dashboard/agents/${encodeURIComponent(job.payload.agentId)}`
        : job.type === 'workflow.run' && job.payload?.workflowId
          ? `/dashboard/workflows/${encodeURIComponent(job.payload.workflowId)}/runs`
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
  if (!['QUEUED', 'RETRY_WAIT', 'RUNNING'].includes(status) || isCanceled(job)) return null;
  const attempt = Number(job.attempts || 0) + 1;
  if (attempt > Number(job.maxAttempts || 3)) return null;
  const nowIso = new Date(now).toISOString();
  const leaseUntil = new Date(now + jobLeaseMs()).toISOString();
  const leaseToken = `${(requestId || 'worker').slice(0, 27)}-${randomUUID()}`;
  const queries = [
    Query.equal('status', status),
    Query.equal('attempts', attempt - 1),
    Query.equal('cancelRequested', false),
    ...(status === 'RUNNING'
      ? expiredLeaseQueries(job, now)
      : [Query.lessThanEqual('runAfter', nowIso)]),
  ];
  return updateJob(services, job, queries, {
    status: 'RUNNING',
    attempts: attempt,
    startedAt: job.startedAt || nowIso,
    heartbeatAt: nowIso,
    leaseExpiresAt: leaseUntil,
    leaseToken,
    error: '',
  });
}

function leaseExpiry(job) {
  if (job.leaseExpiresAt) return Date.parse(job.leaseExpiresAt);
  return Date.parse(job.heartbeatAt || job.startedAt || job.runAfter) + jobLeaseMs();
}

function expiredLeaseQueries(job, now) {
  if (job.leaseExpiresAt) {
    return [Query.lessThanEqual('leaseExpiresAt', new Date(now).toISOString())];
  }
  // Older rows may only have a heartbeat. A worker that renews the lease
  // between the read and the update will set leaseExpiresAt and block recovery.
  const staleAt = new Date(now - jobLeaseMs()).toISOString();
  return [
    Query.isNull('leaseExpiresAt'),
    Query.lessThanEqual(
      job.heartbeatAt ? 'heartbeatAt' : job.startedAt ? 'startedAt' : 'runAfter',
      staleAt,
    ),
  ];
}

async function updateJob(services, job, queries, data) {
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
        ...queries,
        Query.limit(1),
      ],
      total: false,
    });
    if (!rows.length) return null;
    await tables.updateTransaction({ transactionId, commit: true });
    committed = true;
    return decodeRow({ ...rows[0], ...changes });
  } catch (error) {
    if (Number(error?.code) === 409) return null;
    throw error;
  } finally {
    if (!committed) {
      await tables.updateTransaction({ transactionId, rollback: true }).catch(() => undefined);
    }
  }
}

function updateWithLease(services, job, data, queries = []) {
  return updateJob(
    services,
    job,
    [Query.equal('status', 'RUNNING'), Query.equal('leaseToken', job.leaseToken), ...queries],
    data,
  );
}

function readJob(services, job) {
  return getOwned(services, TABLES.backgroundJobs, job.id, job.organizationId);
}

async function finishDispatchFailure(services, job, error) {
  const updated = await updateJob(
    services,
    job,
    [
      Query.equal('status', job.status),
      Query.equal('attempts', job.attempts),
      Query.equal('runAfter', job.runAfter),
    ],
    {
      status: 'FAILED',
      error: JSON.stringify({
        code: error?.code === 'ASYNC_WORKER_NOT_CONFIGURED' ? error.code : 'BACKEND_ERROR',
      }),
      completedAt: new Date().toISOString(),
    },
  );
  return updated || readJob(services, job);
}

async function finishRun(services, job, outcome) {
  const now = new Date().toISOString();
  const released = {
    heartbeatAt: now,
    leaseExpiresAt: new Date(0).toISOString(),
    leaseToken: '',
  };
  let current = job;
  for (let attempt = 0; attempt < 3; attempt++) {
    const canceled = isCanceled(current);
    const completed = await updateWithLease(
      services,
      job,
      {
        ...released,
        ...(canceled ? { status: 'CANCELED', result: {}, completedAt: now } : outcome),
      },
      [Query.equal('cancelRequested', canceled)],
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
      'knowledge.index',
      'knowledge.ask',
    ].includes(type)
  )
    throw new HttpError('不支持的后台任务类型', 400, 'JOB_TYPE_INVALID');
  const serialized = JSON.stringify(payload || {});
  if (Buffer.byteLength(serialized, 'utf8') > MAX_PAYLOAD_BYTES)
    throw new HttpError('后台任务参数过大', 413, 'JOB_PAYLOAD_TOO_LARGE');
  const job = await createRow(services, TABLES.backgroundJobs, context.teamId, {
    type,
    status: 'QUEUED',
    payload,
    result: {},
    error: '',
    attempts: 0,
    maxAttempts: Math.min(10, Math.max(1, Number(options.maxAttempts || 3))),
    runAfter: new Date().toISOString(),
    cancelRequested: false,
    createdBy: context.userId,
  });
  try {
    await dispatchJob(services, job);
  } catch (error) {
    const current = await finishDispatchFailure(services, job, error).catch(() => null);
    // The execution service can accept a request before its response is lost.
    if (current && current.status !== 'FAILED') return publicJob(current);
    throw error;
  }
  return publicJob(job);
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

function isCanceled(job) {
  return job.status === 'CANCELED' || Boolean(job.cancelRequested);
}

function canRetry(error, job) {
  return (
    Number(job.attempts || 0) < Number(job.maxAttempts || 3) && RETRYABLE_CODES.has(error?.code)
  );
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
  if (['QUEUED', 'RETRY_WAIT'].includes(job.status) && new Date(job.runAfter).getTime() > now)
    return publicJob(job);

  const running = await claimJob(services, job, now, requestId);
  if (!running) return publicJob(await readJob(services, job));

  const heartbeat = setInterval(() => {
    void updateWithLease(services, running, {
      heartbeatAt: new Date().toISOString(),
      leaseExpiresAt: new Date(Date.now() + jobLeaseMs()).toISOString(),
    }).catch(() => {
      // Later deliveries can recover the lease if heartbeats stop succeeding.
    });
  }, heartbeatIntervalMs());
  heartbeat.unref?.();
  const context = {
    teamId: organizationId,
    userId: job.createdBy,
    requestId: requestId || `job-${job.id}`,
  };
  const outcome = await runPayload(services, running, context)
    .then(
      (result) => ({
        status: 'SUCCEEDED',
        result,
        completedAt: new Date().toISOString(),
      }),
      (error) => {
        const retry = canRetry(error, running);
        const delay = Math.min(15 * 60_000, 30_000 * 2 ** (running.attempts - 1));
        const nextRun = new Date(Math.ceil((Date.now() + delay) / 60_000) * 60_000);
        return {
          status: retry ? 'RETRY_WAIT' : 'FAILED',
          error: JSON.stringify({ code: error?.code || 'BACKEND_ERROR' }),
          runAfter: retry ? nextRun.toISOString() : undefined,
          completedAt: retry ? undefined : new Date().toISOString(),
        };
      },
    )
    .finally(() => clearInterval(heartbeat));

  const finished = await finishRun(services, running, outcome);
  if (!finished) return publicJob(await readJob(services, job));
  if (finished.status === 'RETRY_WAIT') {
    try {
      await dispatchJob(services, finished, finished.runAfter);
    } catch (error) {
      return publicJob(await finishDispatchFailure(services, finished, error));
    }
  }
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
    [
      Query.equal('status', 'RUNNING'),
      Query.equal('attempts', job.attempts),
      job.leaseToken == null
        ? Query.isNull('leaseToken')
        : Query.equal('leaseToken', job.leaseToken),
      Query.equal('cancelRequested', canceled),
      ...expiredLeaseQueries(job, now),
    ],
    {
      status,
      error: JSON.stringify({ code: 'JOB_WORKER_TIMEOUT' }),
      runAfter: new Date(now).toISOString(),
      completedAt: status === 'RETRY_WAIT' ? undefined : new Date(now).toISOString(),
      leaseToken: '',
      leaseExpiresAt: new Date(0).toISOString(),
    },
  );
  if (!recovered) return readJob(services, job);
  if (status === 'RETRY_WAIT') {
    try {
      await dispatchJob(services, recovered);
    } catch (error) {
      return finishDispatchFailure(services, recovered, error);
    }
  }
  return recovered;
}

export async function getJob(services, teamId, jobId) {
  return publicJob(
    await recoverStaleJob(services, await getOwned(services, TABLES.backgroundJobs, jobId, teamId)),
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
      publicJobSummary(await recoverStaleJob(services, decodeRow(row))),
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
      [Query.equal('status', job.status), Query.equal('cancelRequested', false)],
      {
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
