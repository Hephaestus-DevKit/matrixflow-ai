import {
  Account,
  Client,
  ExecutionMethod,
  Functions,
  ID,
  Permission,
  Role,
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
  const permissions = [
    Permission.read(Role.team(teamId)),
    Permission.update(Role.team(teamId)),
    Permission.delete(Role.team(teamId, 'owner')),
    Permission.delete(Role.team(teamId, 'admin')),
  ];

  const tables = new TablesDB(client);
  const row = await tables.createRow({
    databaseId: 'matrixflow',
    tableId: 'agents',
    rowId: ID.unique(),
    data: {
      organizationId: teamId,
      name: 'MatrixFlow smoke test',
      role: 'tester',
      model: 'glm-4-plus',
      status: 'DRAFT',
      systemPrompt: '{}',
      skills: '[]',
      configuration: '{}',
    },
    permissions,
  });
  const listed = await tables.listRows({
    databaseId: 'matrixflow',
    tableId: 'agents',
  });
  if (!listed.rows.some((candidate) => candidate.$id === row.$id)) {
    throw new Error('Created row was not visible through team permissions');
  }
  await tables.deleteRow({ databaseId: 'matrixflow', tableId: 'agents', rowId: row.$id });

  const functions = new Functions(client);
  const health = await functions.createExecution({
    functionId: 'matrixflow-core',
    body: JSON.stringify({ organizationId: teamId }),
    async: false,
    xpath: '/health',
    method: ExecutionMethod.POST,
    headers: { 'content-type': 'application/json' },
  });
  if (health.responseStatusCode !== 200) {
    throw new Error(`Core health check failed with ${health.responseStatusCode}`);
  }
  const healthPayload = JSON.parse(health.responseBody);
  if (healthPayload?.data?.architecture !== 'appwrite-native') {
    throw new Error('Core health response did not identify the Appwrite-native architecture');
  }
  process.stdout.write('smoke test passed: auth, team, row permissions, function\n');
} finally {
  await account.deleteSession({ sessionId: 'current' }).catch(() => undefined);
}
