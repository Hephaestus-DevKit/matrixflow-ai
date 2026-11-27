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
const functionUrl = 'https://6a7b1d40001e62963eec.sgp.appwrite.run';
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

async function verifyTranslationDelivery(call) {
  let contentProjectId;
  let jobId;
  let jobStatus;
  const terminal = new Set(['SUCCEEDED', 'FAILED', 'CANCELED']);
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
    const batchPath = path + '/translations/' + batch;
    const {
      items: [item],
    } = await call(batchPath + '/items', undefined, ExecutionMethod.GET);
    if (!item?.id || !Number.isInteger(item.revision) || item.identification !== row[1])
      throw new Error('Imported translation is missing its field identity or revision');
    const job = await call(
      batchPath,
      { items: [{ id: item.id, revision: item.revision }] },
      ExecutionMethod.POST,
      202,
    );
    jobId = job.id;
    jobStatus = job.status;
    const deadline = Date.now() + 150_000;
    let latest = job;
    while (!terminal.has(jobStatus) && Date.now() < deadline) {
      await delay(2_000);
      latest = await call(`/jobs/${jobId}`, undefined, ExecutionMethod.GET);
      jobStatus = latest.status;
    }
    if (jobStatus !== 'SUCCEEDED' || latest.result?.completed !== 1) {
      const code = latest.result?.errors?.[0]?.code || latest.error?.code || 'none';
      throw new Error(`Translation job did not complete one field (${jobStatus}, ${code})`);
    }
    const { items } = await call(batchPath + '/items', undefined, ExecutionMethod.GET);
    const draft = items[0];
    if (
      draft?.id !== item.id ||
      draft.reviewed !== false ||
      draft.revision !== item.revision + 1 ||
      draft.text === source ||
      !/^<p>.+<\/p>$/s.test(draft.text)
    ) {
      throw new Error('Provider did not save the translated HTML as an unapproved draft');
    }
    const { text, revision } = draft;
    await call(
      `/content/items/${item.id}/review`,
      { text, revision, reviewed: true },
      ExecutionMethod.PUT,
    );
    const delivery = await call(batchPath, undefined, ExecutionMethod.GET);
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
        await call(`/content/projects/${contentProjectId}`, undefined, ExecutionMethod.DELETE);
      }
    }
  }
}

async function verifyTeamApi(execute, teamId, expectedRelease, aiReady) {
  const issued = await execute('/api-keys', {
    name: 'MatrixFlow production API smoke',
    scopes: ['content.manage', 'workflows.manage'],
    expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
  });
  if (issued.responseStatusCode !== 200)
    throw new Error(`Smoke API key creation failed with ${issued.responseStatusCode}`);
  const { key, metadata } = JSON.parse(issued.responseBody).data;

  async function call(
    path,
    payload,
    method = ExecutionMethod.POST,
    status = 200,
    { team = teamId, token = key, code } = {},
  ) {
    const response = await fetch(functionUrl + path, {
      method,
      headers: {
        'X-MatrixFlow-Organization': team,
        ...(token && { Authorization: `Bearer ${token}` }),
        ...(payload !== undefined && { 'Content-Type': 'application/json' }),
      },
      body: typeof payload === 'string' ? payload : JSON.stringify(payload),
      redirect: 'error',
      signal: AbortSignal.timeout(45_000),
    });
    const result = await response.json().catch(() => ({}));
    if (response.status !== status || (code && result.error?.code !== code))
      throw new Error(
        `Direct API smoke: ${method} ${path} returned ${response.status} (${result.error?.code || 'unknown'})`,
      );
    return result.data;
  }

  try {
    if (!/^mf_live_[\w-]+$/.test(key ?? '') || !metadata?.id)
      throw new Error('Smoke API key response was incomplete');
    const health = await call('/health', undefined, ExecutionMethod.GET);
    if (health.status !== 'ok' || health.version !== expectedRelease)
      throw new Error('Direct API returned an unexpected health or release value');
    await call('/health', undefined, ExecutionMethod.GET, 401, {
      token: null,
      code: 'UNAUTHENTICATED',
    });
    await call('/health', undefined, ExecutionMethod.GET, 401, {
      team: ID.unique(),
      code: 'API_KEY_INVALID',
    });
    await call('/admin/health', undefined, ExecutionMethod.GET, 403, { code: 'ADMIN_REQUIRED' });
    await call('/billing/invoices', undefined, ExecutionMethod.GET, 403, {
      code: 'API_KEY_SCOPE_REQUIRED',
    });
    await call('/content/projects', '{', ExecutionMethod.POST, 400, { code: 'INVALID_JSON' });
    if (aiReady) await verifyTranslationDelivery(call);
  } finally {
    if (metadata?.id) {
      const revoked = await execute(`/api-keys/${metadata.id}`, {}, ExecutionMethod.DELETE);
      if (revoked.responseStatusCode !== 200)
        throw new Error(`Smoke API key revocation failed with ${revoked.responseStatusCode}`);
    }
  }
  await call('/health', undefined, ExecutionMethod.GET, 401, { code: 'API_KEY_INVALID' });
  process.stdout.write(
    'team API key smoke passed: empty GET, release, malformed JSON, authentication, team isolation, scopes, revocation\n',
  );
  if (aiReady)
    process.stdout.write(
      'direct translation API smoke passed: import, draft retrieval, background job, approval, export\n',
    );
}

const teams = new Teams(client);
const functions = new Functions(client);
let teamId;
const execute = (xpath, body = {}, method = ExecutionMethod.POST) =>
  functions.createExecution({
    functionId: 'matrixflow-core',
    body: JSON.stringify({ ...body, organizationId: teamId }),
    async: false,
    xpath,
    method,
    headers: { 'content-type': 'application/json' },
  });

try {
  const current = await account.get();
  if (!current.emailVerification) throw new Error('Smoke-test account is not verified');

  const team = await teams.create({
    teamId: ID.unique(),
    name: 'MatrixFlow isolated production smoke',
    roles: ['owner', 'admin'],
  });
  teamId = team.$id;
  const tables = new TablesDB(client);
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

  await verifyTeamApi(execute, teamId, expectedRelease || adminHealthPayload.release, aiReady);
  process.stdout.write(
    `smoke test passed: auth, team, server-only writes, row reads, function; ai=${aiSmoke}\n`,
  );
} finally {
  try {
    if (teamId) {
      const cleanup = await execute(
        '/account',
        { confirmation: teamId, reason: 'isolated smoke cleanup' },
        ExecutionMethod.DELETE,
      );
      if (cleanup.responseStatusCode !== 200)
        throw new Error(`Isolated smoke data cleanup failed with ${cleanup.responseStatusCode}`);
      await teams.delete({ teamId });
      process.stdout.write('isolated smoke team and business data removed\n');
    }
  } finally {
    await account.deleteSession({ sessionId: 'current' });
  }
}
