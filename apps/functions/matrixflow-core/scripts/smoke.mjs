import {
  Account,
  Client,
  ExecutionMethod,
  Functions,
  ID,
  TablesDB,
  Teams,
} from 'node-appwrite';

const email = process.env.MATRIXFLOW_TEST_EMAIL;
const password = process.env.MATRIXFLOW_TEST_PASSWORD;
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
  if (!directCreateWasDenied) throw new Error('Browser-equivalent direct row creation was not denied');

  const created = await execute('/agents', {
    name: 'MatrixFlow smoke test',
    role: 'tester',
    systemPrompt: {},
    skills: [],
    tools: [],
  });
  if (created.responseStatusCode !== 200)
    throw new Error(`Secure agent creation failed with ${created.responseStatusCode}`);
  const rowId = JSON.parse(created.responseBody)?.data?.id;
  const listed = await tables.listRows({ databaseId: 'matrixflow', tableId: 'agents' });
  if (!listed.rows.some((candidate) => candidate.$id === rowId))
    throw new Error('Function-created row was not visible through team permissions');
  const deleted = await execute(`/agents/${rowId}`, {}, ExecutionMethod.DELETE);
  if (deleted.responseStatusCode !== 200) throw new Error('Secure agent deletion failed');

  process.stdout.write('smoke test passed: auth, team, server-only writes, row reads, function\n');
} finally {
  await account.deleteSession({ sessionId: 'current' }).catch(() => undefined);
}
