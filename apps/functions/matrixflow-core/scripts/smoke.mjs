import { setTimeout as delay } from 'node:timers/promises';
import {
  Account,
  Client,
  ExecutionMethod,
  Functions,
  ID,
  Query,
  TablesDB,
  Teams,
} from 'node-appwrite';

const email = process.env.MATRIXFLOW_TEST_EMAIL;
const password = process.env.MATRIXFLOW_TEST_PASSWORD;
const requireAiSmoke = /^(1|true|yes)$/i.test(process.env.MATRIXFLOW_REQUIRE_AI_SMOKE || '');
if (!email || !password) throw new Error('Smoke-test credentials are required');

const endpoint = 'https://sgp.cloud.appwrite.io/v1';
const projectId = '6a43f0af000862e7b0ef';
const login = await fetch(`${endpoint}/account/sessions/email`, {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    'x-appwrite-project': projectId,
  },
  body: JSON.stringify({ email, password }),
});
if (!login.ok) throw new Error(`Appwrite login failed with ${login.status}`);
const cookies = login.headers.getSetCookie?.() ?? [login.headers.get('set-cookie') || ''];
const sessionMatch = cookies.join(';').match(/a_session_[^=]+=([^;]+)/);
if (!sessionMatch) throw new Error('Appwrite did not return a session cookie');

const client = new Client()
  .setEndpoint(endpoint)
  .setProject(projectId)
  .setSession(decodeURIComponent(sessionMatch[1]));
const account = new Account(client);

async function verifyTranslationDelivery(execute, tables) {
  let contentProjectId;
  let jobId;
  let jobStatus;
  const terminal = new Set(['SUCCEEDED', 'FAILED', 'CANCELED']);
  async function call(path, payload = {}, method = ExecutionMethod.POST, status = 200) {
    const execution = await execute(path, payload, method);
    const response = JSON.parse(execution.responseBody || '{}');
    if (execution.responseStatusCode !== status) {
      throw new Error(
        `Translation smoke: ${method} ${path} returned ${execution.responseStatusCode} (${response.error?.code || 'unknown'})`,
      );
    }
    return response.data;
  }
  try {
    const project = await call('/content/projects', {
      name: 'MatrixFlow translation smoke',
      productData: { description: 'Blue travel bag' },
    });
    contentProjectId = project.id;
    const path = `/content/projects/${contentProjectId}`;
    const updated = await call(
      path + '/facts',
      { description: 'Blue travel bag with product information', revision: 0 },
      ExecutionMethod.PUT,
    );
    if (updated.productData?.factsRevision !== 1) throw new Error('Product facts revision failed');

    const headers = [
      'Type',
      'Identification',
      'Field',
      'Locale',
      'Market',
      'Status',
      'Default content',
      'Translated content',
    ];
    const source = '<p>Blue travel bag.</p>';
    const row = ['PRODUCT', '000071', 'body_html', 'de', '', '', source, ''];
    const { batch } = await call(path + '/translations', {
      filename: 'smoke.csv',
      headers,
      rows: [row],
    });
    const {
      rows: [item],
    } = await tables.listRows({
      databaseId: 'matrixflow',
      tableId: 'content_items',
      queries: [Query.equal('projectId', contentProjectId), Query.limit(1)],
    });
    if (!item) throw new Error('Imported translation is missing');
    const batchPath = path + '/translations/' + batch;
    const job = await call(
      batchPath,
      { items: [{ id: item.$id, revision: JSON.parse(item.body).review.revision }] },
      ExecutionMethod.POST,
      202,
    );
    jobId = job.id;
    jobStatus = job.status;
    const deadline = Date.now() + 150_000;
    let latest = job;
    while (!terminal.has(jobStatus) && Date.now() < deadline) {
      await delay(2_000);
      latest = await call(`/jobs/${jobId}`, {}, ExecutionMethod.GET);
      jobStatus = latest.status;
    }
    if (jobStatus !== 'SUCCEEDED' || latest.result?.completed !== 1) {
      const code = latest.result?.errors?.[0]?.code || latest.error?.code || 'none';
      throw new Error(`Translation job did not complete one field (${jobStatus}, ${code})`);
    }
    const result = await tables.getRow({
      databaseId: 'matrixflow',
      tableId: 'content_items',
      rowId: item.$id,
    });
    const { text, revision, reviewed } = JSON.parse(result.body).review;
    if (reviewed || text === source || !/^<p>.+<\/p>$/s.test(text)) {
      throw new Error('Provider did not save the translated HTML as an unapproved draft');
    }
    await call(
      `/content/items/${item.$id}/review`,
      { text, revision, reviewed: true },
      ExecutionMethod.PUT,
    );
    const delivery = await call(batchPath, {}, ExecutionMethod.GET);
    if (
      JSON.stringify(delivery.headers) !== JSON.stringify(headers) ||
      JSON.stringify(delivery.rows) !== JSON.stringify([[...row.slice(0, -1), text]])
    ) {
      throw new Error('Approved delivery changed Shopify columns or row identifiers');
    }
  } finally {
    try {
      if (jobId && !terminal.has(jobStatus)) {
        await call(`/jobs/${jobId}/cancel`, { reason: 'smoke_cleanup' });
      }
    } finally {
      if (contentProjectId) {
        await call(`/content/projects/${contentProjectId}`, {}, ExecutionMethod.DELETE);
      }
    }
  }
}

try {
  const current = await account.get();
  if (!current.emailVerification) throw new Error('Smoke-test account is not verified');

  const teams = new Teams(client);
  let teamList = await teams.list();
  if (!teamList.teams.length) {
    await teams.create({
      teamId: ID.unique(),
      name: `${current.name || 'MatrixFlow'} 的团队`,
      roles: ['owner', 'admin'],
    });
    teamList = await teams.list();
  }
  const teamId = teamList.teams[0].$id;
  const tables = new TablesDB(client);
  const functions = new Functions(client);
  const execute = (xpath, body = {}, method = ExecutionMethod.POST) =>
    functions.createExecution({
      functionId: 'matrixflow-core',
      body: JSON.stringify({ ...body, organizationId: teamId }),
      async: false,
      xpath,
      method,
      headers: { 'content-type': 'application/json' },
    });
  const health = await execute('/health', {}, ExecutionMethod.GET);
  if (health.responseStatusCode !== 200) {
    throw new Error(`Core health check failed with ${health.responseStatusCode}`);
  }
  const healthPayload = JSON.parse(health.responseBody);
  if (healthPayload?.data?.architecture !== 'appwrite-native') {
    throw new Error('Core health response did not identify the Appwrite-native architecture');
  }
  const aiReady = healthPayload?.data?.ai?.ready === true;
  if (requireAiSmoke && !aiReady) {
    throw new Error('Production AI smoke is required, but /health reports no configured provider');
  }
  const adminHealth = await execute('/admin/health', {}, ExecutionMethod.GET);
  if (adminHealth.responseStatusCode !== 200) {
    throw new Error(`Admin health check failed with ${adminHealth.responseStatusCode}`);
  }
  const adminHealthPayload = JSON.parse(adminHealth.responseBody)?.data;
  if (
    !['ok', 'degraded', 'failed'].includes(adminHealthPayload?.status) ||
    !adminHealthPayload?.checks ||
    typeof adminHealthPayload?.release !== 'string'
  ) {
    throw new Error('Admin health response did not return a safe readiness snapshot');
  }
  const expectedRelease = process.env.MATRIXFLOW_RELEASE;
  if (expectedRelease && adminHealthPayload.release !== expectedRelease) {
    throw new Error('Active Function release does not match the deployed commit');
  }
  const serializedHealth = JSON.stringify(adminHealthPayload);
  if (/["'][^"']*(?:api[_-]?key|secret|token|password)[^"']*["']\s*:/i.test(serializedHealth)) {
    throw new Error('Admin health response leaked a secret-shaped field');
  }

  let directCreateWasDenied = false;
  try {
    await tables.createRow({
      databaseId: 'matrixflow',
      tableId: 'agents',
      rowId: ID.unique(),
      data: { organizationId: teamId, name: 'must fail', role: 'tester' },
    });
  } catch (error) {
    directCreateWasDenied = error?.code === 401 || error?.code === 403;
  }
  if (!directCreateWasDenied)
    throw new Error('Browser-equivalent direct row creation was not denied');

  let rowId;
  let aiSmoke = 'skipped (provider not configured)';
  try {
    const created = await execute('/agents', {
      name: 'MatrixFlow smoke test',
      role: 'tester',
      systemPrompt: {
        raw: 'You are a production smoke-test assistant. Answer briefly and never include secrets.',
      },
      skills: [],
      tools: [],
      maxTokens: 64,
    });
    if (created.responseStatusCode !== 200)
      throw new Error(`Secure agent creation failed with ${created.responseStatusCode}`);
    rowId = JSON.parse(created.responseBody)?.data?.id;
    if (!rowId) throw new Error('Secure agent creation did not return an id');

    const listed = await tables.listRows({
      databaseId: 'matrixflow',
      tableId: 'agents',
      queries: [Query.equal('$id', rowId), Query.limit(1)],
    });
    if (!listed.rows.some((candidate) => candidate.$id === rowId))
      throw new Error('Function-created row was not visible through team permissions');

    if (aiReady) {
      const run = await execute(`/agents/${rowId}/run`, {
        input: { prompt: 'Reply with a short confirmation that the service is ready.' },
      });
      if (run.responseStatusCode !== 200)
        throw new Error(`Real provider execution failed with ${run.responseStatusCode}`);
      const runPayload = JSON.parse(run.responseBody)?.data;
      if (
        runPayload?.status !== 'COMPLETED' ||
        typeof runPayload?.output?.text !== 'string' ||
        !runPayload.output.text.trim() ||
        !runPayload?.output?.provider ||
        !runPayload?.output?.protocol ||
        !runPayload?.output?.model
      ) {
        throw new Error('Real provider execution returned an incomplete result');
      }
      aiSmoke = `${runPayload.output.provider}/${runPayload.output.model}`;
    }
  } finally {
    if (rowId) {
      const deleted = await execute(`/agents/${rowId}`, {}, ExecutionMethod.DELETE);
      if (deleted.responseStatusCode !== 200) throw new Error('Secure agent deletion failed');
    }
  }

  if (aiReady) {
    await verifyTranslationDelivery(execute, tables);
    process.stdout.write(
      'translation smoke passed: facts revision, background job, approval, delivery, cleanup\n',
    );
  }
  process.stdout.write(
    `smoke test passed: auth, team, server-only writes, row reads, function; ai=${aiSmoke}\n`,
  );
} finally {
  await account.deleteSession({ sessionId: 'current' }).catch(() => undefined);
}
