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
} from '../runtime.js';
import { generateAllContent, generateContent } from '../features.js';
import { parse, schemas } from '../schemas.js';
import { enqueueJob } from '../jobs.js';
import { HttpResult } from '../http.js';

export async function handleContentRoute({
  services,
  context,
  membership,
  segments,
  method,
  body,
}) {
  if (method === 'POST' && segments.length === 2 && segments[1] === 'projects') {
    requireCapability(membership, 'content.manage');
    const input = parse(schemas.contentProject, body);
    const reservation = await reservePlanResourceLimit(
      services,
      context.teamId,
      'contentProjectLimit',
      10,
      '内容项目',
    );
    let project;
    try {
      project = await createRow(services, TABLES.contentProjects, context.teamId, {
        ...input,
        status: 'ACTIVE',
      });
      await recordAudit(
        services,
        context,
        'content_project.created',
        'content_project',
        project.id,
      );
      return project;
    } catch (error) {
      if (project) {
        try {
          await deleteOwned(services, TABLES.contentProjects, project.id, context.teamId);
          await releasePlanResourceLimit(services, context.teamId, reservation);
        } catch {
          // Keep the reservation when compensation is incomplete.
        }
      } else
        await releasePlanResourceLimit(services, context.teamId, reservation).catch(
          () => undefined,
        );
      throw error;
    }
  }

  if (
    method === 'POST' &&
    segments.length === 4 &&
    segments[1] === 'projects' &&
    segments[2] &&
    segments[3] === 'generate'
  ) {
    requireCapability(membership, 'content.manage');
    await getOwned(services, TABLES.contentProjects, segments[2], context.teamId);
    return generateContent(services, context, {
      projectId: segments[2],
      ...parse(schemas.contentGenerate, body),
    });
  }

  if (
    method === 'POST' &&
    segments.length === 4 &&
    segments[1] === 'projects' &&
    segments[2] &&
    segments[3] === 'generate-all'
  ) {
    requireCapability(membership, 'content.manage');
    await getOwned(services, TABLES.contentProjects, segments[2], context.teamId);
    const input = parse(schemas.contentGenerate, body);
    if (input.mode === 'async')
      return new HttpResult(
        await enqueueJob(services, context, 'content.generate-all', {
          projectId: segments[2],
          type: input.type,
          language: input.language,
          variables: input.variables,
        }),
        202,
      );
    return generateAllContent(services, context, {
      projectId: segments[2],
      ...input,
    });
  }

  if (method === 'DELETE' && segments.length === 3 && segments[1] === 'projects' && segments[2]) {
    requireCapability(membership, 'content.manage');
    const items = await listRows(services, TABLES.contentItems, context.teamId, [
      Query.equal('projectId', segments[2]),
    ]);
    await Promise.all(
      items.map((item) => deleteOwned(services, TABLES.contentItems, item.id, context.teamId)),
    );
    await deleteOwned(services, TABLES.contentProjects, segments[2], context.teamId);
    await releasePlanResourceLimit(services, context.teamId, {
      bucket: 'resource:contentProjectLimit',
    }).catch(() => undefined);
    await recordAudit(
      services,
      context,
      'content_project.deleted',
      'content_project',
      segments[2],
      { deletedItems: items.length },
    );
    return { deleted: true };
  }

  throw new HttpError('函数路由不存在', 404, 'ROUTE_NOT_FOUND');
}
