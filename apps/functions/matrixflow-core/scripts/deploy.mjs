import { Client, Functions, ID, Runtime } from 'node-appwrite';
import { InputFile } from 'node-appwrite/file';

const endpoint = process.env.MATRIXFLOW_APPWRITE_ENDPOINT || 'https://sgp.cloud.appwrite.io/v1';
const projectId = process.env.MATRIXFLOW_APPWRITE_PROJECT_ID || '6a43f0af000862e7b0ef';
const key = process.env.MATRIXFLOW_DEPLOY_KEY;
const archive = process.env.MATRIXFLOW_FUNCTION_ARCHIVE;
if (!key || !archive) throw new Error('Deployment key and function archive are required');

const client = new Client().setEndpoint(endpoint).setProject(projectId).setKey(key);
const functions = new Functions(client);
const functionId = 'matrixflow-core';
const tokenRhythmKey =
  process.env.TOKENRHYTHM_API_KEY?.trim() || process.env.OPENAI_COMPATIBLE_API_KEY?.trim() || '';
const configuration = {
  functionId,
  name: 'MatrixFlow Core',
  runtime: Runtime.Node22,
  // The function is callable by API-key clients; every protected route still
  // requires a verified Appwrite session or a scoped MatrixFlow key.
  execute: ['any'],
  events: [],
  timeout: 120,
  enabled: true,
  logging: true,
  entrypoint: 'src/main.js',
  commands: 'npm ci --omit=dev',
  scopes: [
    'teams.read',
    'rows.read',
    'rows.write',
    'buckets.read',
    'files.read',
    'files.write',
    'executions.write',
  ],
  deploymentRetention: 5,
};

try {
  await functions.get({ functionId });
  await functions.update(configuration);
} catch (error) {
  if (error?.code !== 404) throw error;
  await functions.create(configuration);
}

const existingVariables = await functions.listVariables({ functionId });
const managedVariables = [
  ['MATRIXFLOW_AI_PROVIDER', 'tokenrhythm'],
  ['TOKENRHYTHM_BASE_URL', 'https://tokenrhythm.studio/v1'],
  ['TOKENRHYTHM_MODEL', 'deepseek-v4-flash-0731'],
  ['OPENAI_MAX_TOKENS_FIELD', 'max_tokens'],
  ['MATRIXFLOW_AI_TIMEOUT_MS', '25000'],
  ['MATRIXFLOW_AI_MAX_RETRIES', '2'],
  ['MATRIXFLOW_AI_FALLBACK', 'false'],
  ['MATRIXFLOW_REQUIRE_PROVIDER', 'false'],
  ['MATRIXFLOW_REQUIRE_ASYNC', 'false'],
  ['MATRIXFLOW_REQUIRE_BILLING', 'false'],
  ['MATRIXFLOW_JOB_LEASE_MS', '90000'],
  ['MATRIXFLOW_JOB_HEARTBEAT_MS', '15000'],
  ['MATRIXFLOW_ALLOW_INSECURE_PROVIDER', 'false'],
  ['MATRIXFLOW_ALLOW_PRIVATE_PROVIDER', 'false'],
  ['MATRIXFLOW_DATABASE_ID', 'matrixflow'],
  ['MATRIXFLOW_KNOWLEDGE_BUCKET_ID', 'knowledge-files'],
  ['MATRIXFLOW_AI_MONTHLY_LIMIT', '100'],
  ['MATRIXFLOW_AI_PER_MINUTE_LIMIT', '20'],
  ['MATRIXFLOW_REQUESTS_PER_MINUTE', '120'],
  ['MATRIXFLOW_AGENT_LIMIT', '10'],
  ['MATRIXFLOW_CONTENT_PROJECT_LIMIT', '10'],
  ['MATRIXFLOW_KNOWLEDGE_BASE_LIMIT', '5'],
  ['MATRIXFLOW_WORKFLOW_LIMIT', '3'],
  ['MATRIXFLOW_RELEASE', process.env.MATRIXFLOW_RELEASE || 'production'],
];
if (tokenRhythmKey) managedVariables.push(['TOKENRHYTHM_API_KEY', tokenRhythmKey, true]);

for (const [variableKey, value, secret = false] of managedVariables) {
  const existing = existingVariables.variables.find((variable) => variable.key === variableKey);
  if (existing) {
    await functions.updateVariable({
      functionId,
      variableId: existing.$id,
      key: variableKey,
      value,
      secret,
    });
  } else {
    await functions.createVariable({
      functionId,
      variableId: ID.unique(),
      key: variableKey,
      value,
      secret,
    });
  }
}

const deployment = await functions.createDeployment({
  functionId,
  code: InputFile.fromPath(archive, 'matrixflow-core.tar.gz'),
  activate: true,
  entrypoint: 'src/main.js',
  commands: 'npm ci --omit=dev',
});

for (let attempt = 0; attempt < 120; attempt += 1) {
  const current = await functions.getDeployment({ functionId, deploymentId: deployment.$id });
  if (current.status === 'ready') {
    const functionState = await functions.get({ functionId });
    if (functionState.deploymentId !== deployment.$id)
      throw new Error(
        `Function deployment ${deployment.$id} is ready but not active (active: ${functionState.deploymentId || 'none'})`,
      );
    process.stdout.write(`deployed function ${functionId} (${deployment.$id})\n`);
    process.exit(0);
  }
  if (current.status === 'failed') throw new Error(current.buildLogs || 'Function build failed');
  await new Promise((resolve) => setTimeout(resolve, 2_000));
}
throw new Error('Function deployment timed out');
