import { TABLES, getTeamPlan, recordAudit, requireAdmin, requireCapability } from '../runtime.js';
import { deleteOrganization, exportOrganization } from '../account.js';
import { createApiKey, listApiKeys, revokeApiKey } from '../api-keys.js';
import { cancelJob, getJob, listJobs } from '../jobs.js';
import { parse, schemas } from '../schemas.js';

export async function handleSystemRoute({
  services,
  context,
  membership,
  path,
  segments,
  method,
  body,
  ai,
  readinessSnapshot,
}) {
  if (method === 'GET' && path === '/admin/health') {
    requireAdmin(membership);
    const readiness = readinessSnapshot();
    return {
      status: readiness.status,
      service: 'matrixflow-core',
      release: process.env.MATRIXFLOW_RELEASE || 'production',
      checks: readiness.checks,
      ai: readiness.ai,
      requestId: context.requestId,
      timestamp: new Date().toISOString(),
    };
  }

  if (method === 'GET' && path === '/health') {
    const plan = await getTeamPlan(services, context.teamId);
    const readiness = readinessSnapshot();
    return {
      status: 'ok',
      architecture: 'appwrite-native',
      database: { ready: true },
      readiness: { status: readiness.status, checks: readiness.checks },
      ai,
      requestId: context.requestId,
      version: process.env.MATRIXFLOW_RELEASE || 'production',
      timestamp: new Date().toISOString(),
      limits: {
        plan: plan.id,
        monthlyAiCalls: plan.aiCallsPerMonth,
        aiCallsPerMinute: plan.aiCallsPerMinute,
        agents: plan.agentLimit,
        contentProjects: plan.contentProjectLimit,
        knowledgeBases: plan.knowledgeBaseLimit,
        workflows: plan.workflowLimit,
      },
    };
  }

  if (method === 'GET' && path === '/account/export') {
    requireAdmin(membership);
    const data = await exportOrganization(services, context.teamId);
    await recordAudit(services, context, 'account.exported', 'organization', context.teamId, {
      rowCount: data.rowCount,
    });
    return data;
  }

  if (method === 'DELETE' && path === '/account') {
    requireAdmin(membership);
    const input = parse(schemas.accountDelete, body);
    const result = await deleteOrganization(services, context.teamId, input.confirmation, {
      preserveIdempotencyId: context.idempotencyId,
    });
    await recordAudit(
      services,
      context,
      'account.deletion_completed',
      'organization',
      context.teamId,
      { ...result, reason: input.reason },
    );
    return { ...result, auditRetention: 'security-and-billing-events-retained' };
  }

  if (method === 'GET' && path === '/api-keys') {
    requireAdmin(membership);
    return listApiKeys(services, context.teamId);
  }

  if (method === 'POST' && path === '/api-keys') {
    requireAdmin(membership);
    const key = await createApiKey(services, context, parse(schemas.apiKeyCreate, body));
    await recordAudit(services, context, 'api_key.created', 'api_key', key.metadata.id, {
      scopes: key.metadata.scopes,
    });
    return key;
  }

  if (method === 'DELETE' && segments.length === 2 && segments[0] === 'api-keys' && segments[1]) {
    requireAdmin(membership);
    const revoked = await revokeApiKey(services, context, segments[1]);
    await recordAudit(services, context, 'api_key.revoked', 'api_key', segments[1]);
    return revoked;
  }

  if (method === 'GET' && path === '/jobs') {
    requireCapability(membership, 'workflows.manage');
    return listJobs(services, context.teamId, body);
  }

  if (method === 'GET' && segments.length === 2 && segments[0] === 'jobs' && segments[1]) {
    requireCapability(membership, 'workflows.manage');
    return getJob(services, context.teamId, segments[1]);
  }

  if (
    method === 'POST' &&
    segments.length === 3 &&
    segments[0] === 'jobs' &&
    segments[1] &&
    segments[2] === 'cancel'
  ) {
    requireCapability(membership, 'workflows.manage');
    const input = parse(schemas.jobCancel, body);
    return cancelJob(services, context, segments[1], input.reason);
  }

  return null;
}
