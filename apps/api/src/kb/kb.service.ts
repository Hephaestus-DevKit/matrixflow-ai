import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';
import { FileService } from '../file/file.service';
import { AuditService } from '../common/audit.service';
import { randomUUID } from 'crypto';
import { basename, extname } from 'path';
import { QueueService } from '../queue/queue.service';

const CHUNK_SIZE = 800; // 字符
const CHUNK_OVERLAP = 100;
const SUPPORTED_EXTENSIONS = new Set(['pdf', 'docx', 'txt', 'md', 'csv']);

@Injectable()
export class KbService {
  constructor(private prisma: PrismaService, private ai: AiService, private file: FileService, private audit: AuditService, private queue: QueueService) {}

  async list(organizationId: string) {
    return this.prisma.knowledgeBase.findMany({ where: { organizationId, deletedAt: null }, include: { _count: { select: { documents: true } } }, orderBy: { createdAt: 'desc' } });
  }

  async create(organizationId: string, userId: string, input: { name: string; description?: string }) {
    const name = input.name?.trim();
    if (!name || name.length > 100 || (input.description?.length ?? 0) > 2_000) throw new BadRequestException('Invalid knowledge base name or description');
    const kb = await this.prisma.knowledgeBase.create({ data: { organizationId, name, description: input.description?.trim() } });
    await this.audit.log({ action: 'kb.create', userId, organizationId, resource: 'kb', resourceId: kb.id });
    return kb;
  }

  async get(organizationId: string, id: string) {
    const kb = await this.prisma.knowledgeBase.findFirst({ where: { id, organizationId, deletedAt: null }, include: { documents: { where: { deletedAt: null }, orderBy: { createdAt: 'desc' } } } });
    if (!kb) throw new NotFoundException();
    return kb;
  }

  async uploadDocument(organizationId: string, userId: string, kbId: string, file: Express.Multer.File) {
    if (!file) throw new BadRequestException('File is required');

    const extension = extname(file.originalname).slice(1).toLowerCase();
    const configuredExtensions = new Set(
      (process.env.UPLOAD_ALLOWED_TYPES ?? 'pdf,docx,txt,md,csv')
        .split(',')
        .map((value) => value.trim().toLowerCase())
        .filter(Boolean),
    );
    if (!SUPPORTED_EXTENSIONS.has(extension) || !configuredExtensions.has(extension)) {
      throw new BadRequestException(`Unsupported file type: ${extension || 'unknown'}`);
    }
    this.assertFileSignature(extension, file.buffer);

    const kb = await this.prisma.knowledgeBase.findFirst({ where: { id: kbId, organizationId } });
    if (!kb) throw new NotFoundException('Knowledge base not found');

    // 上传到 MinIO
    const safeName = basename(file.originalname).replace(/[^a-zA-Z0-9._-]/g, '_') || `document.${extension}`;
    const objectKey = `kb/${kbId}/${randomUUID()}-${safeName}`;
    await this.file.upload(objectKey, file.buffer, file.mimetype);

    // 创建文档记录
    const doc = await this.prisma.knowledgeDocument.create({ data: { knowledgeBaseId: kbId, organizationId, title: safeName, sourceType: extension, objectKey, mimeType: file.mimetype, sizeBytes: file.size, status: 'pending' } }).catch(async (error) => {
      await this.file.delete(objectKey).catch(() => undefined);
      throw error;
    });

    try {
      await this.queue.enqueueDocument(doc.id);
    } catch (error) {
      await this.prisma.knowledgeDocument.update({ where: { id: doc.id }, data: { status: 'failed', error: 'Unable to enqueue document processing' } });
      throw error;
    }

    await this.audit.log({ action: 'kb.upload', userId, organizationId, resource: 'document', resourceId: doc.id });
    return doc;
  }

  async processDocument(docId: string) {
    const doc = await this.prisma.knowledgeDocument.findUnique({ where: { id: docId } });
    if (!doc || doc.deletedAt || doc.status === 'ready') return;
    const leaseCutoff = new Date(Date.now() - Number(process.env.DOCUMENT_PROCESSING_LEASE_MS ?? 10 * 60_000));
    const claimed = await this.prisma.knowledgeDocument.updateMany({
      where: {
        id: docId,
        deletedAt: null,
        OR: [
          { status: { in: ['pending', 'failed'] } },
          { status: { in: ['parsing', 'chunking', 'embedding'] }, updatedAt: { lt: leaseCutoff } },
        ],
      },
      data: { status: 'parsing', error: null },
    });
    if (claimed.count !== 1) return;
    try {
      // 从 MinIO 拉取
      const buf = await this.file.download(doc.objectKey!);

      // 调用 Python Sidecar 进行解析与分块
      const sidecarUrl = process.env.SIDECAR_PYTHON_URL || 'http://localhost:8001';
      const formData = new FormData();
      // Copy the Buffer into a standalone ArrayBuffer. Node's Buffer is typed
      // with ArrayBufferLike, which is not assignable to BlobPart on newer
      // TypeScript/Node versions (and avoids sharing a pooled backing buffer).
      const blob = new Blob([new Uint8Array(buf).slice().buffer], { type: doc.mimeType || 'application/octet-stream' });
      formData.append('file', blob, doc.title || 'document');

      const response = await fetch(
        `${sidecarUrl}/parse?chunk_size=${CHUNK_SIZE}&overlap=${CHUNK_OVERLAP}`,
        {
          method: 'POST',
          body: formData,
          signal: AbortSignal.timeout(Number(process.env.SIDECAR_TIMEOUT_MS ?? 60_000)),
        }
      );

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Sidecar parser failed with status ${response.status}: ${errText}`);
      }

      const parsedData = (await response.json()) as { text?: unknown; chunks?: unknown };
      if (typeof parsedData.text !== 'string' || !Array.isArray(parsedData.chunks) || parsedData.chunks.some((chunk) => typeof chunk !== 'string')) {
        throw new Error('Sidecar returned an invalid payload');
      }
      const maxChunks = Number(process.env.SIDECAR_MAX_CHUNKS ?? 10_000);
      if (parsedData.chunks.length > maxChunks) throw new Error(`Document exceeds ${maxChunks} chunks`);
      const text = parsedData.text;
      const chunks = parsedData.chunks as string[];

      await this.prisma.knowledgeDocument.update({ where: { id: docId }, data: { content: text, status: 'chunking' } });

      // A retry may follow a partial failure. Clear partial derived data so the
      // unique (documentId, chunkIndex) key cannot make every retry fail.
      await this.prisma.$executeRaw`DELETE FROM embeddings WHERE chunk_id IN (SELECT id FROM document_chunks WHERE document_id = ${docId}::uuid)`;
      await this.prisma.documentChunk.deleteMany({ where: { documentId: docId } });
      await this.prisma.knowledgeDocument.update({ where: { id: docId }, data: { status: 'embedding' } });

      for (let i = 0; i < chunks.length; i++) {
        const c = await this.prisma.documentChunk.create({ data: { documentId: docId, organizationId: doc.organizationId, chunkIndex: i, content: chunks[i], tokenCount: Math.ceil(chunks[i].length / 4) } });
        // 向量化
        const emb = await this.ai.embedding(chunks[i], doc.organizationId);
        const vector = this.toVectorLiteral(emb.vector);
        // 写入 embeddings 表 (raw SQL, pgvector)
        await this.prisma.$executeRaw`INSERT INTO embeddings (id, chunk_id, model, vector) VALUES (${randomUUID()}::uuid, ${c.id}::uuid, ${process.env.EMBEDDING_MODEL ?? 'embedding-3'}, ${vector}::vector)`;
      }
      await this.prisma.knowledgeDocument.update({ where: { id: docId }, data: { status: 'ready' } });
    } catch (e) {
      await this.prisma.knowledgeDocument.update({ where: { id: docId }, data: { status: 'failed', error: (e as Error).message } });
      throw e;
    }
  }

  async ragQuery(organizationId: string, kbId: string, question: string, userId?: string) {
    question = question?.trim();
    if (!question || question.length > 4_000) throw new BadRequestException('Question must contain 1-4000 characters');
    const kb = await this.prisma.knowledgeBase.findFirst({ where: { id: kbId, organizationId } });
    if (!kb) throw new NotFoundException('Knowledge base not found');

    // 向量检索 top-5
    const qEmb = await this.ai.embedding(question, organizationId);
    const queryVector = this.toVectorLiteral(qEmb.vector);
    const results: { chunk_id: string; document_id: string; content: string; score: number; doc_title: string }[] = await this.prisma.$queryRaw`
      SELECT dc.id AS chunk_id, kd.id AS document_id, dc.content, 1 - (e.vector <=> ${queryVector}::vector) AS score, kd.title AS doc_title
      FROM embeddings e
      JOIN document_chunks dc ON dc.id = e.chunk_id
      JOIN knowledge_documents kd ON kd.id = dc.document_id
      WHERE dc.organization_id = ${organizationId}::uuid
        AND kd.knowledge_base_id = ${kbId}::uuid
        AND kd.deleted_at IS NULL
      ORDER BY e.vector <=> ${queryVector}::vector
      LIMIT 5
    `;
    if (results.length === 0) return { answer: '未在知识库中找到相关内容', citations: [] };

    const context = results.map((r, i) => `[doc${i + 1}] ${r.content}`).join('\n\n');
    const answer = await this.ai.runPrompt({ promptKey: 'rag_qa', variables: { context, question }, organizationId, userId: userId ?? '', responseFormat: 'json_object' });
    let parsed: any; try { parsed = JSON.parse(answer.content); } catch { parsed = { answer: answer.content, citations: [] }; }
    return { answer: parsed.answer ?? answer.content, citations: results.map((r) => ({ docId: r.document_id, chunkId: r.chunk_id, snippet: r.content.slice(0, 200), title: r.doc_title, score: r.score })) };
  }

  async deleteDocument(organizationId: string, docId: string) {
    const doc = await this.prisma.knowledgeDocument.findFirst({ where: { id: docId, organizationId } });
    if (!doc) throw new NotFoundException();
    await this.prisma.knowledgeDocument.update({ where: { id: docId }, data: { deletedAt: new Date() } });
    return { ok: true };
  }

  private assertFileSignature(extension: string, buffer: Buffer) {
    if (extension === 'pdf' && buffer.subarray(0, 5).toString('ascii') !== '%PDF-') {
      throw new BadRequestException('Invalid PDF signature');
    }
    if (extension === 'docx' && !(buffer[0] === 0x50 && buffer[1] === 0x4b)) {
      throw new BadRequestException('Invalid DOCX signature');
    }
    if (['txt', 'md', 'csv'].includes(extension) && buffer.includes(0)) {
      throw new BadRequestException('Text files must not contain binary null bytes');
    }
  }

  private toVectorLiteral(vector: number[]): string {
    const expectedDimensions = Number(process.env.EMBEDDING_DIM ?? 1536);
    if (vector.length !== expectedDimensions || vector.some((value) => !Number.isFinite(value))) {
      throw new Error(`Embedding must contain ${expectedDimensions} finite dimensions`);
    }
    return `[${vector.join(',')}]`;
  }
}
