import { Account, Client, ExecutionMethod, Functions, ID, TablesDB, Teams } from 'node-appwrite';

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
  const health = await execute('/health');
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

    const listed = await tables.listRows({ databaseId: 'matrixflow', tableId: 'agents' });
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
      const deleted = await execute(`/agents/${rowId}`, {}, ExecutionMethod.DELETE).catch(
        () => null,
      );
      if (deleted && deleted.responseStatusCode !== 200)
        throw new Error('Secure agent deletion failed');
    }
  }

  process.stdout.write(
    `smoke test passed: auth, team, server-only writes, row reads, function; ai=${aiSmoke}\n`,
  );
} finally {
  await account.deleteSession({ sessionId: 'current' }).catch(() => undefined);
}
