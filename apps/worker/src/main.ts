import { ConnectionOptions, Worker } from 'bullmq';
import IORedis from 'ioredis';
import pino from 'pino';
import { createInternalClient } from './internal-client';

const logger = pino({ level: process.env.LOG_LEVEL ?? 'info' });
const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379/0';
const internalApiUrl = (process.env.INTERNAL_API_URL ?? 'http://localhost:3001/api/v1').replace(
  /\/$/,
  '',
);
const internalJobSecret = process.env.INTERNAL_JOB_SECRET ?? '';
const concurrency = Math.max(1, Number(process.env.QUEUE_CONCURRENCY ?? 4));
const requestTimeoutMs = Math.max(1_000, Number(process.env.INTERNAL_JOB_TIMEOUT_MS ?? 300_000));

const callInternal = createInternalClient({
  baseUrl: internalApiUrl,
  secret: internalJobSecret,
  timeoutMs: requestTimeoutMs,
});

const redisClients: IORedis[] = [];
function createConnection(): IORedis {
  const client = new IORedis(redisUrl, { maxRetriesPerRequest: null });
  redisClients.push(client);
  return client;
}

const documentWorker = new Worker<{ docId: string }>(
  'document-processing',
  async (job) => {
    logger.info({ jobId: job.id, docId: job.data.docId }, 'Processing document');
    return callInternal(`/internal/jobs/documents/${encodeURIComponent(job.data.docId)}/process`);
  },
  {
    connection: createConnection() as unknown as ConnectionOptions,
    concurrency: Math.min(4, concurrency),
  },
);

const workflowWorker = new Worker<{ runId: string; userId: string }>(
  'workflow-execution',
  async (job) => {
    logger.info({ jobId: job.id, runId: job.data.runId }, 'Executing workflow');
    return callInternal(`/internal/jobs/workflows/${encodeURIComponent(job.data.runId)}/execute`, {
      userId: job.data.userId,
    });
  },
  { connection: createConnection() as unknown as ConnectionOptions, concurrency },
);

[documentWorker, workflowWorker].forEach((worker) => {
  worker.on('failed', (job, error) =>
    logger.error({ jobId: job?.id, error: error.message }, 'Job failed'),
  );
  worker.on('completed', (job) => logger.info({ jobId: job.id }, 'Job completed'));
  worker.on('error', (error) => logger.error({ error: error.message }, 'Worker error'));
});

logger.info({ concurrency }, 'MatrixFlow AI Worker started');

let shuttingDown = false;
const shutdown = async () => {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info('MatrixFlow AI Worker shutting down');
  await Promise.all([documentWorker.close(), workflowWorker.close()]);
  await Promise.all(redisClients.map((client) => client.quit().catch(() => undefined)));
};

process.on('SIGTERM', () => void shutdown().then(() => process.exit(0)));
process.on('SIGINT', () => void shutdown().then(() => process.exit(0)));
