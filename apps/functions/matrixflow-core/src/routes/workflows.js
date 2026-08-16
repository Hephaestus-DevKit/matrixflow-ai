import { Query } from 'node-appwrite';
import {
  HttpError,
  TABLES,
  createRow,
  deleteOwned,
  getOwned,
  listRows,
  recordAudit,
  requireCapability,
  releasePlanResourceLimit,
  reservePlanResourceLimit,
  updateOwned,
} from '../runtime.js';
import { runWorkflow } from '../features.js';
import { parse, schemas } from '../schemas.js';
import { enqueueJob } from '../jobs.js';
import { HttpResult } from '../http.js';

async function createWorkflow(services, context, input) {
  const workflow = await createRow(services, TABLES.workflows, context.teamId, {
    ...input,
    status: 'DRAFT',
    currentVersion: 1,
  });
  let version;
  try {
    version = await createRow(services, TABLES.workflowVersions, context.teamId, {
      workflowId: workflow.id,
      version: 1,
      dsl: input.dsl,
      createdBy: context.userId,
    });
    await recordAudit(services, context, 'workflow.created', 'workflow', workflow.id);
    return workflow;
  } catch (error) {
    if (version)
      await deleteOwned(services, TABLES.workflowVersions, version.id, context.teamId).catch(
        () => undefined,
      );
    await deleteOwned(services, TABLES.workflows, workflow.id, context.teamId).catch(
      () => undefined,
    );
    throw error;
  }
}

async function createWorkflowVersion(services, context, workflowId, input) {
  const workflow = await getOwned(services, TABLES.workflows, workflowId, context.teamId);
  const versionNumber = Number(workflow.currentVersion || 1) + 1;
  const version = await createRow(services, TABLES.workflowVersions, context.teamId, {
    workflowId: workflow.id,
    version: versionNumber,
    dsl: input.dsl,
    createdBy: context.userId,
  });
  let updated;
  try {
    updated = await updateOwned(services, TABLES.workflows, workflow.id, context.teamId, {
      dsl: input.dsl,
      currentVersion: versionNumber,
      status: 'ACTIVE',
    });
    await recordAudit(services, context, 'workflow.version_created', 'workflow', workflow.id, {
      version: versionNumber,
      changeNote: input.changeNote,
    });
    return updated;
  } catch (error) {
    if (updated)
      await updateOwned(services, TABLES.workflows, workflow.id, context.teamId, {
        dsl: workflow.dsl,
        currentVersion: workflow.currentVersion,
        status: workflow.status,
      }).catch(() => undefined);
    await deleteOwned(services, TABLES.workflowVersions, version.id, context.teamId).catch(
      () => undefined,
    );
    throw error;
  }
}

export async function handleWorkflowRoute({
  services,
  context,
  membership,
  segments,
  method,
  body,
}) {
  if (method === 'POST' && segments.length === 1) {
    requireCapability(membership, 'workflows.manage');
    const input = parse(schemas.workflowCreate, body);
    const reservation = await reservePlanResourceLimit(
      services,
      context.teamId,
      'workflowLimit',
      3,
      '工作流',
    );
    try {
      return await createWorkflow(services, context, input);
    } catch (error) {
      await releasePlanResourceLimit(services, context.teamId, reservation).catch(() => undefined);
      throw error;
    }
  }

  if (method === 'POST' && segments.length === 3 && segments[1] && segments[2] === 'versions') {
    requireCapability(membership, 'workflows.manage');
    return createWorkflowVersion(
      services,
      context,
      segments[1],
      parse(schemas.workflowVersion, body),
    );
  }

  if (method === 'POST' && segments.length === 3 && segments[1] && segments[2] === 'run') {
    requireCapability(membership, 'workflows.manage');
    const input = parse(schemas.workflowRun, body);
    await getOwned(services, TABLES.workflows, segments[1], context.teamId);
    if (input.mode === 'async')
      return new HttpResult(
        await enqueueJob(services, context, 'workflow.run', {
          workflowId: segments[1],
          input: input.input,
          retryOf: input.retryOf,
          retryCount: input.retryCount,
        }),
        202,
      );
    return runWorkflow(services, context, { workflowId: segments[1], ...input });
  }

  if (
    method === 'POST' &&
    segments.length === 5 &&
    segments[1] &&
    segments[2] === 'runs' &&
    segments[3] &&
    segments[4] === 'retry'
  ) {
    requireCapability(membership, 'workflows.manage');
    const previous = await getOwned(services, TABLES.workflowRuns, segments[3], context.teamId);
    if (previous.workflowId !== segments[1])
      throw new HttpError('运行记录不属于该工作流', 403, 'FORBIDDEN');
    if (!['FAILED', 'COMPLETED'].includes(previous.status))
      throw new HttpError('当前运行状态不可重试', 409, 'RUN_NOT_RETRYABLE');
    return runWorkflow(services, context, {
      workflowId: segments[1],
      input: previous.output?.input || {},
      retryOf: previous.id,
      retryCount: Math.min(10, Number(previous.retryCount || 0) + 1),
    });
  }

  if (method === 'DELETE' && segments.length === 2 && segments[1]) {
    requireCapability(membership, 'workflows.manage');
    const [versions, runs] = await Promise.all([
      listRows(services, TABLES.workflowVersions, context.teamId, [
        Query.equal('workflowId', segments[1]),
      ]),
      listRows(services, TABLES.workflowRuns, context.teamId, [
        Query.equal('workflowId', segments[1]),
      ]),
    ]);
    await Promise.all([
      ...versions.map((version) =>
        deleteOwned(services, TABLES.workflowVersions, version.id, context.teamId),
      ),
      ...runs.map((run) => deleteOwned(services, TABLES.workflowRuns, run.id, context.teamId)),
    ]);
    await deleteOwned(services, TABLES.workflows, segments[1], context.teamId);
    await releasePlanResourceLimit(services, context.teamId, {
      bucket: 'resource:workflowLimit',
    }).catch(() => undefined);
    await recordAudit(services, context, 'workflow.deleted', 'workflow', segments[1], {
      deletedVersions: versions.length,
      deletedRuns: runs.length,
    });
    return { deleted: true };
  }

  throw new HttpError('函数路由不存在', 404, 'ROUTE_NOT_FOUND');
}
