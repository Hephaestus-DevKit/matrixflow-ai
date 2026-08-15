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
const configuration = {
  functionId,
  name: 'MatrixFlow Core',
  runtime: Runtime.Node22,
  execute: ['users/verified'],
  events: [],
  timeout: 120,
  enabled: true,
  logging: true,
  entrypoint: 'src/main.js',
  commands: 'npm ci --omit=dev',
  scopes: ['teams.read', 'rows.read', 'rows.write', 'buckets.read', 'files.read', 'files.write'],
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
for (const [variableKey, value] of [
  ['MATRIXFLOW_AI_PROVIDER', 'auto'],
  ['MATRIXFLOW_AI_TIMEOUT_MS', '25000'],
  ['MATRIXFLOW_AI_MAX_RETRIES', '2'],
  ['MATRIXFLOW_DATABASE_ID', 'matrixflow'],
  ['MATRIXFLOW_KNOWLEDGE_BUCKET_ID', 'knowledge-files'],
  ['MATRIXFLOW_AI_MONTHLY_LIMIT', '100'],
  ['MATRIXFLOW_AI_PER_MINUTE_LIMIT', '20'],
]) {
  const existing = existingVariables.variables.find((variable) => variable.key === variableKey);
  if (existing) {
    await functions.updateVariable({
      functionId,
      variableId: existing.$id,
      key: variableKey,
      value,
      secret: false,
    });
  } else {
    await functions.createVariable({
      functionId,
      variableId: ID.unique(),
      key: variableKey,
      value,
      secret: false,
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
    process.stdout.write(`deployed function ${functionId} (${deployment.$id})\n`);
    process.exit(0);
  }
  if (current.status === 'failed') throw new Error(current.buildLogs || 'Function build failed');
  await new Promise((resolve) => setTimeout(resolve, 2_000));
}
throw new Error('Function deployment timed out');
