import { Worker, Queue } from 'bullmq';
import IORedis from 'ioredis';

const connection = new IORedis(process.env.REDIS_URL ?? 'redis://localhost:6379/0', { maxRetriesPerRequest: null });

// ---- 队列定义 ----
export const documentQueue = new Queue('document-processing', { connection: connection as any });
export const workflowQueue = new Queue('workflow-execution', { connection: connection as any });
export const embeddingQueue = new Queue('embedding', { connection: connection as any });
export const emailQueue = new Queue('email', { connection: connection as any });

// ---- Document Worker ----
const docWorker = new Worker('document-processing', async (job) => {
  console.log(`[doc-worker] Processing document ${job.data.docId}`);
  // 调用后端 API 触发文档处理（或直接 import service）
  // 生产环境：import KbService 并调用 processDocument
  return { docId: job.data.docId, status: 'processed' };
}, { connection: connection as any, concurrency: 2 });

// ---- Workflow Worker ----
const wfWorker = new Worker('workflow-execution', async (job) => {
  console.log(`[wf-worker] Running workflow ${job.data.workflowId}`);
  return { workflowId: job.data.workflowId, status: 'completed' };
}, { connection: connection as any, concurrency: 4 });

// ---- Embedding Worker ----
const embWorker = new Worker('embedding', async (job) => {
  console.log(`[emb-worker] Embedding chunk ${job.data.chunkId}`);
  return { chunkId: job.data.chunkId, status: 'embedded' };
}, { connection: connection as any, concurrency: 8 });

// ---- Email Worker ----
const emailWorker = new Worker('email', async (job) => {
  console.log(`[email-worker] Sending email to ${job.data.to}`);
  // 生产：调用 SMTP
  return { to: job.data.to, status: 'sent' };
}, { connection: connection as any, concurrency: 10 });

// ---- 事件监听 ----
[docWorker, wfWorker, embWorker, emailWorker].forEach((w) => {
  w.on('failed', (job, err) => console.error(`[worker] Job ${job?.id} failed:`, err.message));
  w.on('completed', (job) => console.log(`[worker] Job ${job.id} completed`));
});

console.log('🚀 MatrixFlow AI Worker started');

// 优雅关闭
process.on('SIGTERM', async () => {
  await Promise.all([docWorker.close(), wfWorker.close(), embWorker.close(), emailWorker.close()]);
  process.exit(0);
});
