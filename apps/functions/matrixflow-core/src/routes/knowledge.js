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
import { askKnowledgeBase, indexDocument } from '../features.js';
import { parse, schemas } from '../schemas.js';
import { enqueueJob } from '../jobs.js';
import { deleteKnowledgeFile, validateKnowledgeFile } from '../knowledge-files.js';
import { HttpResult } from '../http.js';

async function deleteKnowledgeChunks(services, teamId, documentId) {
  const chunks = await listRows(services, TABLES.knowledgeChunks, teamId, [
    Query.equal('documentId', documentId),
  ]);
  await Promise.all(
    chunks.map((chunk) => deleteOwned(services, TABLES.knowledgeChunks, chunk.id, teamId)),
  );
  return chunks.length;
}

async function cleanupStorageFile(services, context, document) {
  try {
    await deleteKnowledgeFile(services, document.fileId);
    return true;
  } catch (error) {
    await recordAudit(
      services,
      context,
      'knowledge_file.cleanup_pending',
      'knowledge_document',
      document.id,
      {
        fileId: document.fileId,
        status: Number(error?.status || error?.code) || 500,
      },
    ).catch(() => undefined);
    return false;
  }
}

async function deleteDocumentData(services, context, document) {
  const deletedChunks = await deleteKnowledgeChunks(services, context.teamId, document.id);
  await deleteOwned(services, TABLES.knowledgeDocuments, document.id, context.teamId);
  const storageDeleted = await cleanupStorageFile(services, context, document);
  return { deletedChunks, storageDeleted };
}

export async function handleKnowledgeRoute({
  services,
  context,
  membership,
  segments,
  method,
  body,
}) {
  if (method === 'POST' && segments.length === 1) {
    requireCapability(membership, 'knowledge.manage');
    const input = parse(schemas.knowledgeBase, body);
    const reservation = await reservePlanResourceLimit(
      services,
      context.teamId,
      'knowledgeBaseLimit',
      5,
      '知识库',
    );
    let base;
    try {
      base = await createRow(services, TABLES.knowledgeBases, context.teamId, {
        ...input,
        status: 'ACTIVE',
      });
      await recordAudit(services, context, 'knowledge_base.created', 'knowledge_base', base.id);
      return base;
    } catch (error) {
      if (base) {
        try {
          await deleteOwned(services, TABLES.knowledgeBases, base.id, context.teamId);
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

  if (method === 'POST' && segments.length === 2 && segments[1] === 'documents') {
    requireCapability(membership, 'knowledge.manage');
    const input = parse(schemas.knowledgeDocument, body);
    await getOwned(services, TABLES.knowledgeBases, input.knowledgeBaseId, context.teamId);
    const file = await validateKnowledgeFile(services, context.teamId, input);
    let document;
    try {
      document = await createRow(services, TABLES.knowledgeDocuments, context.teamId, {
        ...input,
        ...file,
        status: 'UPLOADED',
      });
      await recordAudit(
        services,
        context,
        'knowledge_document.created',
        'knowledge_document',
        document.id,
      );
      return document;
    } catch (error) {
      let safeToDeleteFile = !document;
      if (document) {
        try {
          await deleteOwned(services, TABLES.knowledgeDocuments, document.id, context.teamId);
          safeToDeleteFile = true;
        } catch {
          // Preserve the file when rollback cannot remove its referencing row.
        }
      }
      if (safeToDeleteFile) await deleteKnowledgeFile(services, file.fileId).catch(() => undefined);
      throw error;
    }
  }

  if (method === 'POST' && segments.length === 2 && segments[1] === 'index') {
    requireCapability(membership, 'knowledge.manage');
    const input = parse(schemas.knowledgeIndex, body);
    await getOwned(services, TABLES.knowledgeDocuments, input.documentId, context.teamId);
    if (input.mode === 'async')
      return new HttpResult(
        await enqueueJob(services, context, 'knowledge.index', { documentId: input.documentId }),
        202,
      );
    return indexDocument(services, context, { documentId: input.documentId });
  }

  if (method === 'POST' && segments.length === 3 && segments[1] && segments[2] === 'ask') {
    requireCapability(membership, 'knowledge.manage');
    return askKnowledgeBase(services, context, {
      knowledgeBaseId: segments[1],
      ...parse(schemas.knowledgeAsk, body),
    });
  }

  if (
    method === 'DELETE' &&
    segments.length === 4 &&
    segments[1] &&
    segments[2] === 'documents' &&
    segments[3]
  ) {
    requireCapability(membership, 'knowledge.manage');
    const document = await getOwned(
      services,
      TABLES.knowledgeDocuments,
      segments[3],
      context.teamId,
    );
    if (document.knowledgeBaseId !== segments[1])
      throw new HttpError('文档不属于该知识库', 403, 'FORBIDDEN');
    const cleanup = await deleteDocumentData(services, context, document);
    await recordAudit(
      services,
      context,
      'knowledge_document.deleted',
      'knowledge_document',
      document.id,
      cleanup,
    );
    return { deleted: true, storageCleanupPending: !cleanup.storageDeleted };
  }

  if (method === 'DELETE' && segments.length === 2 && segments[1]) {
    requireCapability(membership, 'knowledge.manage');
    await getOwned(services, TABLES.knowledgeBases, segments[1], context.teamId);
    const documents = await listRows(services, TABLES.knowledgeDocuments, context.teamId, [
      Query.equal('knowledgeBaseId', segments[1]),
    ]);
    let storageCleanupPending = 0;
    for (const document of documents) {
      const cleanup = await deleteDocumentData(services, context, document);
      if (!cleanup.storageDeleted) storageCleanupPending += 1;
    }
    await deleteOwned(services, TABLES.knowledgeBases, segments[1], context.teamId);
    await releasePlanResourceLimit(services, context.teamId, {
      bucket: 'resource:knowledgeBaseLimit',
    }).catch(() => undefined);
    await recordAudit(services, context, 'knowledge_base.deleted', 'knowledge_base', segments[1], {
      deletedDocuments: documents.length,
      storageCleanupPending,
    });
    return { deleted: true, storageCleanupPending };
  }

  throw new HttpError('函数路由不存在', 404, 'ROUTE_NOT_FOUND');
}
