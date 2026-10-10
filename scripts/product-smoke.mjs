import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
const require = createRequire(
  new URL('../apps/functions/matrixflow-core/package.json', import.meta.url),
);
const {
  Client,
  Functions,
  Storage,
  Teams,
  Permission,
  Role,
  ExecutionMethod,
} = require('node-appwrite');
const { InputFile } = require('node-appwrite/file');

// Explicit invocation only: uses the existing Appwrite CLI login to create an
// isolated, verified test account. Credentials remain in process memory.
function cli(service, method, ...args) {
  try {
    return JSON.parse(
      execFileSync('appwrite', [service, method, ...args, '--json'], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      }),
    );
  } catch {
    throw new Error(`Appwrite CLI failed: ${service}.${method}`);
  }
}
const endpoint = process.env.MATRIXFLOW_APPWRITE_ENDPOINT || 'https://sgp.cloud.appwrite.io/v1';
const projectId = process.env.MATRIXFLOW_APPWRITE_PROJECT_ID || '6a43f0af000862e7b0ef';
const userId = `ux-${randomUUID().slice(0, 24)}`;
const teamId = `ux-${randomUUID().slice(0, 24)}`;
let createdUser = false;
let createdTeam = false;
let functions;
const jobs = [];
const summary = { userId, teamId, checks: [], cleanup: false };
async function call(path, body = {}, method = ExecutionMethod.POST) {
  const execution = await functions.createExecution({
    functionId: 'matrixflow-core',
    body: JSON.stringify({ ...body, organizationId: teamId }),
    xpath: path,
    method,
    async: false,
    headers: {
      'content-type': 'application/json',
      ...(method === ExecutionMethod.GET ? {} : { 'idempotency-key': `smoke-${randomUUID()}` }),
    },
  });
  const response = JSON.parse(execution.responseBody || '{}');
  if (execution.responseStatusCode < 200 || execution.responseStatusCode >= 300)
    throw new Error(
      `${path}: HTTP ${execution.responseStatusCode}, ${response.error?.code || response.code || 'unknown'}`,
    );
  return response.data ?? response;
}
async function waitJob(job) {
  assert.ok(job.id);
  jobs.push(job.id);
  for (let attempt = 0; attempt < 90; attempt++) {
    const current = await call(`/jobs/${job.id}`, {}, ExecutionMethod.GET);
    if (current.status === 'SUCCEEDED') return current.result;
    if (['FAILED', 'CANCELED'].includes(current.status))
      throw new Error(`Job ${job.type}: ${current.status}, ${current.error?.code || 'unknown'}`);
    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }
  throw new Error(`Job ${job.type} did not finish within 180 seconds`);
}
try {
  cli(
    'users',
    'create',
    '--user-id',
    userId,
    '--email',
    `${userId}@example.invalid`,
    '--name',
    'MatrixFlow UX smoke',
  );
  createdUser = true;
  cli('users', 'update-email-verification', '--user-id', userId, '--email-verification=true');
  const session = cli('users', 'create-session', '--user-id', userId, '--show-secrets');
  assert.ok(session.secret, 'CLI did not return a test session');
  const client = new Client()
    .setEndpoint(endpoint)
    .setProject(projectId)
    .setSession(session.secret);
  functions = new Functions(client);
  const teams = new Teams(client);
  const storage = new Storage(client);
  await teams.create({
    teamId,
    name: 'MatrixFlow isolated UX verification',
    roles: ['owner', 'admin'],
  });
  createdTeam = true;
  const health = await call('/health', {}, ExecutionMethod.GET);
  assert.equal(health.ai.ready, true);
  assert.equal(health.ai.model, 'deepseek-flash');
  summary.release = health.version;
  summary.checks.push('DeepSeek Flash readiness');
  const base = await call('/kb', {
    name: 'Smoke product facts',
    description: 'Isolated fixture, safe to delete',
  });
  const fileId = `ux-${randomUUID().slice(0, 24)}`;
  const fixtureBytes = Buffer.from(
    'Product: Travel bag. Confirmed capacity: 20 liters. Material: nylon. No warranty terms have been provided.',
  );
  await storage.createFile({
    bucketId: 'knowledge-files',
    fileId,
    file: InputFile.fromBuffer(fixtureBytes, 'smoke-facts.txt'),
    permissions: [Permission.read(Role.team(teamId))],
  });
  const document = await call('/kb/documents', {
    knowledgeBaseId: base.id,
    title: 'smoke-facts.txt',
    fileId,
    mimeType: 'text/plain',
    size: fixtureBytes.length,
  });
  const index = await waitJob(await call('/kb/index', { documentId: document.id, mode: 'async' }));
  assert.equal(index.status, 'READY');
  summary.checks.push('Durable async knowledge indexing');
  const agent = await call('/agents', {
    name: 'Grounded support smoke',
    role: 'Customer support',
    knowledgeBaseId: base.id,
    systemPrompt: { raw: 'Answer clearly in English. Use only confirmed handbook facts.' },
  });
  const output = await waitJob(
    await call(`/agents/${agent.id}/run`, {
      input: { prompt: 'What is the travel bag capacity? Do you know its warranty policy?' },
      mode: 'async',
    }),
  );
  assert.ok(output.output?.text?.length > 10);
  assert.ok(output.output?.citations?.length > 0);
  assert.equal(output.output.citations[0].docId, document.id);
  summary.checks.push('Async worker grounded in its own team knowledge, with citations');
  const answer = await waitJob(
    await call(`/kb/${base.id}/ask`, {
      question: 'What is the capacity of the travel bag?',
      mode: 'async',
    }),
  );
  assert.ok(answer.answer?.length > 5);
  assert.equal(answer.citations[0].docId, document.id);
  summary.checks.push('Durable knowledge answer and source recovery');
  const project = await call('/content/projects', {
    name: 'Smoke travel bag',
    productData: {
      title: 'Travel bag',
      description: '20 L capacity, nylon material. No discount or certification claims.',
    },
  });
  const content = await waitJob(
    await call(`/content/projects/${project.id}/generate`, {
      type: 'product_title',
      language: 'de',
      variables: { targetMarket: 'Germany / Amazon', tone: 'Clear and factual' },
      mode: 'async',
    }),
  );
  assert.ok(content.content?.length > 5);
  summary.checks.push('Async targeted German content generation');
  const workflow = await call('/workflows', {
    name: 'Smoke input transform',
    dsl: {
      nodes: [{ id: 'transform', type: 'transform', config: { template: '{{input.product}}' } }],
      edges: [],
    },
  });
  const run = await waitJob(
    await call(`/workflows/${workflow.id}/run`, { input: { product: 'smoke-bag' }, mode: 'async' }),
  );
  assert.equal(run.output?.nodes?.transform, 'smoke-bag');
  summary.checks.push('Async workflow input execution');
  await call(`/agents/${agent.id}`, { status: 'PAUSED' }, ExecutionMethod.PATCH);
  await call(
    `/agents/${agent.id}`,
    { status: 'ACTIVE', name: 'Edited smoke worker', knowledgeBaseId: null },
    ExecutionMethod.PATCH,
  );
  summary.checks.push('Worker editing, pause/resume and unlinking knowledge');
} finally {
  if (createdTeam && functions) {
    try {
      for (const jobId of jobs) {
        const job = await call(`/jobs/${jobId}`, {}, ExecutionMethod.GET);
        if (!['SUCCEEDED', 'FAILED', 'CANCELED'].includes(job.status))
          await call(`/jobs/${jobId}/cancel`, { reason: 'smoke_cleanup' });
      }
      const deleted = await call(
        '/account',
        { confirmation: teamId, reason: 'isolated smoke cleanup' },
        ExecutionMethod.DELETE,
      );
      summary.deletedRows = deleted.totalRows;
      cli('teams', 'delete', '--team-id', teamId);
      summary.cleanup = true;
    } catch (error) {
      summary.cleanupError = error.message;
    }
  }
  if (createdUser && (!createdTeam || summary.cleanup)) cli('users', 'delete', '--user-id', userId);
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}
assert.equal(summary.cleanup, true, 'Isolated team cleanup requires attention');
