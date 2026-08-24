import { randomUUID, timingSafeEqual } from 'node:crypto';
import { ExecutionMethod, Query } from 'node-appwrite';
import { generateAllContent, indexDocument, runAgent, runWorkflow } from './features.js';
import {
  DATABASE_ID,
  HttpError,
  TABLES,
  createRow,
  decodeRow,
  encodeData,
  getOwned,
  updateOwned,
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
    error: job.error || null,
    result: job.status === 'SUCCEEDED' ? job.result || {} : undefined,
    cancelRequested: Boolean(job.cancelRequested),
  };
}

function publicJobSummary(job) {
  const summary = publicJob(job);
  delete summary.error;
  delete summary.result;
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
 * Claim a job with an atomic Appwrite updateRows operation.
 *
 * A read followed by updateRow is not sufficient here: Appwrite may deliver
 * the same async execution more than once. The status/lease predicates make
 * only one invocation the owner of the job. A stale RUNNING lease can be
 * reclaimed after a worker crash, while a live worker is left untouched.
 */
export async function claimJob(services, job, now = Date.now(), requestId = '') {
  const status = String(job.status || '');
  if (!['QUEUED', 'RETRY_WAIT', 'RUNNING'].includes(status)) return null;

  const nowIso = new Date(now).toISOString();
  const leaseUntil = new Date(now + jobLeaseMs()).toISOString();
  const attempt = Number(job.attempts || 0) + 1;
  const leaseToken = `${requestId || 'worker'}-${cryptoRandomId()}`.slice(0, 64);
  const queries = [
    Query.equal('$id', job.id),
    Query.equal('organizationId', job.organizationId),
    Query.equal('status', status),
  ];

  if (status === 'RUNNING') {
    const staleAt = new Date(now - jobLeaseMs()).toISOString();
    queries.push(Query.lessThanEqual('heartbeatAt', staleAt));
  } else {
    queries.push(Query.lessThanEqual('runAfter', nowIso));
  }

  const response = await services.tables.updateRows({
    databaseId: DATABASE_ID,
    tableId: TABLES.backgroundJobs,
    queries,
    data: encodeData({
      status: 'RUNNING',
      attempts: attempt,
      startedAt: job.startedAt || nowIso,
      heartbeatAt: nowIso,
      leaseExpiresAt: leaseUntil,
      leaseToken,
      error: '',
    }),
  });
  const row = response?.rows?.[0];
  return row ? decodeRow(row) : null;
}

function cryptoRandomId() {
  return randomUUID();
}

async function updateWithLease(services, organizationId, jobId, leaseToken, data) {
  const response = await services.tables.updateRows({
    databaseId: DATABASE_ID,
    tableId: TABLES.backgroundJobs,
    queries: [
      Query.equal('$id', jobId),
      Query.equal('organizationId', organizationId),
      Query.equal('status', 'RUNNING'),
      Query.equal('leaseToken', leaseToken),
    ],
    data: encodeData(data),
  });
  const row = response?.rows?.[0];
  return row ? decodeRow(row) : null;
}

export async function enqueueJob(services, context, type, payload, options = {}) {
  if (!['agent.run', 'workflow.run', 'content.generate-all', 'knowledge.index'].includes(type))
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
    await updateOwned(services, TABLES.backgroundJobs, job.id, context.teamId, {
      status: 'FAILED',
      error: String(error?.message || '异步执行器不可用').slice(0, 1_000),
      completedAt: new Date().toISOString(),
    }).catch(() => undefined);
    throw error;
  }
  return publicJob(job);
}

async function runPayload(services, job, context) {
  const payload = job.payload && typeof job.payload === 'object' ? job.payload : {};
  if (job.type === 'agent.run') return runAgent(services, context, payload);
  if (job.type === 'workflow.run') return runWorkflow(services, context, payload);
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
  if (['SUCCEEDED', 'FAILED', 'CANCELED'].includes(job.status)) return publicJob(job);
  if (isCanceled(job)) {
    const canceled = await updateOwned(services, TABLES.backgroundJobs, job.id, organizationId, {
      status: 'CANCELED',
      completedAt: new Date().toISOString(),
    });
    return publicJob(canceled);
  }
  if (
    job.status === 'RUNNING' &&
    job.leaseExpiresAt &&
    new Date(job.leaseExpiresAt).getTime() > Date.now()
  ) {
    // A duplicate delivery while the original worker is alive is a no-op.
    return publicJob(job);
  }
  if (
    ['QUEUED', 'RETRY_WAIT'].includes(job.status) &&
    new Date(job.runAfter).getTime() > Date.now()
  )
    return publicJob(job);

  const running = await claimJob(services, job, Date.now(), requestId);
  if (!running) {
    const latest = await getOwned(services, TABLES.backgroundJobs, job.id, organizationId);
    return publicJob(latest);
  }
  let heartbeatLost = false;
  const heartbeat = setInterval(() => {
    void updateWithLease(services, organizationId, job.id, running.leaseToken, {
      heartbeatAt: new Date().toISOString(),
      leaseExpiresAt: new Date(Date.now() + jobLeaseMs()).toISOString(),
    })
      .then((updated) => {
        if (!updated) heartbeatLost = true;
      })
      .catch(() => {
        // A transient heartbeat failure must not crash the running task. The
        // lease will expire and a later delivery can safely reclaim it.
      });
  }, heartbeatIntervalMs());
  heartbeat.unref?.();
  const context = {
    teamId: organizationId,
    userId: job.createdBy,
    requestId: requestId || `job-${job.id}`,
  };
  try {
    const result = await runPayload(services, running, context);
    const latest = await getOwned(services, TABLES.backgroundJobs, job.id, organizationId);
    const status = isCanceled(latest) ? 'CANCELED' : 'SUCCEEDED';
    clearInterval(heartbeat);
    const completed = await updateWithLease(services, organizationId, job.id, running.leaseToken, {
      status,
      result: status === 'SUCCEEDED' ? result : {},
      completedAt: new Date().toISOString(),
      heartbeatAt: new Date().toISOString(),
      leaseExpiresAt: new Date(0).toISOString(),
      leaseToken: '',
    });
    if (completed) return publicJob(completed);
    return publicJob(await getOwned(services, TABLES.backgroundJobs, job.id, organizationId));
  } catch (error) {
    clearInterval(heartbeat);
    if (heartbeatLost) {
      return publicJob(await getOwned(services, TABLES.backgroundJobs, job.id, organizationId));
    }
    const retry = canRetry(error, running);
    const delay = Math.min(15 * 60_000, 30_000 * 2 ** (attempts - 1));
    const nextRun = new Date(Math.ceil((Date.now() + delay) / 60_000) * 60_000);
    const failed = await updateWithLease(services, organizationId, job.id, running.leaseToken, {
      status: retry ? 'RETRY_WAIT' : 'FAILED',
      error: String(error?.message || '后台任务失败').slice(0, 1_000),
      runAfter: retry ? nextRun.toISOString() : running.runAfter,
      completedAt: retry ? undefined : new Date().toISOString(),
      heartbeatAt: new Date().toISOString(),
      leaseExpiresAt: new Date(0).toISOString(),
      leaseToken: '',
    });
    if (!failed)
      return publicJob(await getOwned(services, TABLES.backgroundJobs, job.id, organizationId));
    if (retry) {
      try {
        await dispatchJob(services, failed, nextRun.toISOString());
      } catch (dispatchError) {
        const terminal = await updateOwned(
          services,
          TABLES.backgroundJobs,
          job.id,
          organizationId,
          {
            status: 'FAILED',
            error: String(dispatchError?.message || '后台任务重试调度失败').slice(0, 1_000),
            completedAt: new Date().toISOString(),
          },
        );
        return publicJob(terminal);
      }
    }
    if (!retry) return publicJob(failed);
    return publicJob(failed);
  }
}

export async function getJob(services, teamId, jobId) {
  return publicJob(await getOwned(services, TABLES.backgroundJobs, jobId, teamId));
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
  const data = result.rows.map((row) => publicJobSummary(decodeRow(row)));
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
  const job = await getOwned(services, TABLES.backgroundJobs, jobId, context.teamId);
  if (['SUCCEEDED', 'FAILED', 'CANCELED'].includes(job.status)) return publicJob(job);
  const updated = await updateOwned(services, TABLES.backgroundJobs, job.id, context.teamId, {
    status: ['QUEUED', 'RETRY_WAIT'].includes(job.status) ? 'CANCELED' : 'RUNNING',
    cancelRequested: true,
    error: reason ? `取消原因：${reason}`.slice(0, 1_000) : '用户请求取消',
    completedAt: ['QUEUED', 'RETRY_WAIT'].includes(job.status)
      ? new Date().toISOString()
      : undefined,
  });
  return publicJob(updated);
}

export function verifyWorkerRequest(headers) {
  const expected = workerSecret();
  const provided = String(headers?.['x-matrixflow-worker-secret'] || '');
  const actual = Buffer.from(provided, 'utf8');
  const wanted = Buffer.from(expected, 'utf8');
  if (!provided || actual.length !== wanted.length || !timingSafeEqual(actual, wanted))
    throw new HttpError('后台任务凭证无效', 401, 'JOB_WORKER_UNAUTHORIZED');
}
