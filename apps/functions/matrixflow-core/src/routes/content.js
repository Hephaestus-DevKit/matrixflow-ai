import {
  HttpError,
  TABLES,
  createRow,
  deleteOwned,
  getOwned,
  recordAudit,
  requireCapability,
  releasePlanResourceLimit,
  reservePlanResourceLimit,
} from '../runtime.js';
import {
  deleteContentProject,
  generateAllContent,
  generateContent,
  getActiveContentProject,
  updateContentFacts,
} from '../features.js';
import { parse, schemas } from '../schemas.js';
import { enqueueJob } from '../jobs.js';
import {
  saveContentReview,
  importTranslations,
  translateItem,
  reviewedDelivery,
  exportContentReview,
  translationBatchPayload,
} from '../content-delivery.js';
import { HttpResult } from '../http.js';

export async function handleContentRoute({
  services,
  context,
  membership,
  segments,
  method,
  body,
}) {
  if (segments[1] === 'items' && segments.length === 4 && segments[2]) {
    requireCapability(membership, 'content.manage');
    if (method === 'GET' && segments[3] === 'delivery')
      return exportContentReview(services, context, segments[2]);
    if (method === 'PUT' && segments[3] === 'review')
      return saveContentReview(services, context, segments[2], parse(schemas.contentReview, body));
    if (method === 'POST' && segments[3] === 'translate')
      return translateItem(
        services,
        context,
        segments[2],
        parse(schemas.translationGenerate, body).revision,
      );
  }
  if (segments[1] === 'projects' && segments[3] === 'translations' && segments[2]) {
    requireCapability(membership, 'content.manage');
    if (method === 'POST' && segments.length === 4)
      return importTranslations(
        services,
        context,
        segments[2],
        parse(schemas.translationImport, body),
      );
    if (method === 'GET' && segments.length === 5)
      return reviewedDelivery(services, context, segments[2], segments[4]);
    if (method === 'POST' && segments.length === 5) {
      const input = parse(schemas.translationBatch, body);
      const payload = await translationBatchPayload(
        services,
        context,
        segments[2],
        segments[4],
        input.items,
      );
      return new HttpResult(
        await enqueueJob(services, context, 'content.translate-batch', payload),
        202,
      );
    }
  }
  if (
    method === 'PUT' &&
    segments[1] === 'projects' &&
    segments.length === 4 &&
    segments[2] &&
    segments[3] === 'facts'
  ) {
    requireCapability(membership, 'content.manage');
    return updateContentFacts(services, context, segments[2], parse(schemas.contentFacts, body));
  }
  if (method === 'POST' && segments.length === 2 && segments[1] === 'projects') {
    requireCapability(membership, 'content.manage');
    const input = parse(schemas.contentProject, body);
    delete input.productData.factsRevision;
    if (input.productData.knowledgeBaseId) {
      if (typeof input.productData.knowledgeBaseId !== 'string')
        throw new HttpError('知识库标识无效', 400, 'INVALID_REQUEST');
      await getOwned(
        services,
        TABLES.knowledgeBases,
        input.productData.knowledgeBaseId,
        context.teamId,
      );
    }
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
    await getActiveContentProject(services, context.teamId, segments[2]);
    const input = parse(schemas.contentGenerate, body);
    if (input.mode === 'async')
      return new HttpResult(
        await enqueueJob(services, context, 'content.generate', {
          projectId: segments[2],
          type: input.type,
          language: input.language,
          variables: input.variables,
        }),
        202,
      );
    return generateContent(services, context, {
      projectId: segments[2],
      ...input,
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
    await getActiveContentProject(services, context.teamId, segments[2]);
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
    return deleteContentProject(services, context, segments[2]);
  }

  throw new HttpError('函数路由不存在', 404, 'ROUTE_NOT_FOUND');
}
