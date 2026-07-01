import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';
import { FileService } from '../file/file.service';
import { ErrorCode } from '@matrixflow/shared';
import { AuditService } from '../common/audit.service';

const CHUNK_SIZE = 800; // 字符
const CHUNK_OVERLAP = 100;

@Injectable()
export class KbService {
  constructor(private prisma: PrismaService, private ai: AiService, private file: FileService, private audit: AuditService) {}

  async list(organizationId: string) {
    return this.prisma.knowledgeBase.findMany({ where: { organizationId, deletedAt: null }, include: { _count: { select: { documents: true } } }, orderBy: { createdAt: 'desc' } });
  }

  async create(organizationId: string, userId: string, input: { name: string; description?: string }) {
    const kb = await this.prisma.knowledgeBase.create({ data: { organizationId, name: input.name, description: input.description } });
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

    const kb = await this.prisma.knowledgeBase.findFirst({ where: { id: kbId, organizationId } });
    if (!kb) throw new NotFoundException('Knowledge base not found');

    // 上传到 MinIO
    const objectKey = `kb/${kbId}/${Date.now()}-${file.originalname}`;
    await this.file.upload(objectKey, file.buffer, file.mimetype);

    // 创建文档记录
    const doc = await this.prisma.knowledgeDocument.create({ data: { knowledgeBaseId: kbId, organizationId, title: file.originalname, sourceType: this.detectType(file.mimetype), objectKey, mimeType: file.mimetype, sizeBytes: file.size, status: 'pending' } });

    // 异步处理：解析 → 分块 → 向量化（此处同步简化，生产用 BullMQ）
    this.processDocument(doc.id).catch((e) => console.error('doc process failed', e));

    await this.audit.log({ action: 'kb.upload', userId, organizationId, resource: 'document', resourceId: doc.id });
    return doc;
  }

  async processDocument(docId: string) {
    const doc = await this.prisma.knowledgeDocument.findUnique({ where: { id: docId } });
    if (!doc) return;
    try {
      await this.prisma.knowledgeDocument.update({ where: { id: docId }, data: { status: 'parsing' } });
      // 从 MinIO 拉取
      const buf = await this.file.download(doc.objectKey!);

      // 调用 Python Sidecar 进行解析与分块
      const sidecarUrl = process.env.SIDECAR_PYTHON_URL || 'http://localhost:8001';
      const formData = new FormData();
      const blob = new Blob([buf], { type: doc.mimeType || 'application/octet-stream' });
      formData.append('file', blob, doc.title || 'document');

      const response = await fetch(
        `${sidecarUrl}/parse?chunk_size=${CHUNK_SIZE}&overlap=${CHUNK_OVERLAP}`,
        {
          method: 'POST',
          body: formData,
        }
      );

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Sidecar parser failed with status ${response.status}: ${errText}`);
      }

      const parsedData = (await response.json()) as { text: string; chunks: string[] };
      const text = parsedData.text;
      const chunks = parsedData.chunks;

      await this.prisma.knowledgeDocument.update({ where: { id: docId }, data: { content: text, status: 'chunking' } });

      for (let i = 0; i < chunks.length; i++) {
        const c = await this.prisma.documentChunk.create({ data: { documentId: docId, organizationId: doc.organizationId, chunkIndex: i, content: chunks[i], tokenCount: Math.ceil(chunks[i].length / 4) } });
        // 向量化
        await this.prisma.knowledgeDocument.update({ where: { id: docId }, data: { status: 'embedding' } });
        const emb = await this.ai.embedding(chunks[i], doc.organizationId);
        // 写入 embeddings 表 (raw SQL, pgvector)
        await this.prisma.$executeRaw`INSERT INTO embeddings (chunk_id, model, embedding) VALUES (${c.id}::uuid, ${process.env.EMBEDDING_MODEL}, ${emb.vector}::vector)`;
      }
      await this.prisma.knowledgeDocument.update({ where: { id: docId }, data: { status: 'ready' } });
    } catch (e) {
      await this.prisma.knowledgeDocument.update({ where: { id: docId }, data: { status: 'failed', error: (e as Error).message } });
    }
  }

  async ragQuery(organizationId: string, kbId: string, question: string, userId?: string) {
    const kb = await this.prisma.knowledgeBase.findFirst({ where: { id: kbId, organizationId } });
    if (!kb) throw new NotFoundException('Knowledge base not found');

    // 向量检索 top-5
    const qEmb = await this.ai.embedding(question, organizationId);
    const results: { chunk_id: string; content: string; score: number; doc_title: string }[] = await this.prisma.$queryRaw`
      SELECT dc.id AS chunk_id, dc.content, 1 - (e.embedding <=> ${qEmb.vector}::vector) AS score, kd.title AS doc_title
      FROM embeddings e
      JOIN document_chunks dc ON dc.id = e.chunk_id
      JOIN knowledge_documents kd ON kd.id = dc.document_id
      WHERE dc.organization_id = ${organizationId}::uuid
      ORDER BY e.embedding <=> ${qEmb.vector}::vector
      LIMIT 5
    `;
    if (results.length === 0) return { answer: '未在知识库中找到相关内容', citations: [] };

    const context = results.map((r, i) => `[doc${i + 1}] ${r.content}`).join('\n\n');
    const answer = await this.ai.runPrompt({ promptKey: 'rag_qa', variables: { context, question }, organizationId, userId: userId ?? '', responseFormat: 'json_object' });
    let parsed: any; try { parsed = JSON.parse(answer.content); } catch { parsed = { answer: answer.content, citations: [] }; }
    return { answer: parsed.answer ?? answer.content, citations: results.map((r, i) => ({ docId: r.chunk_id, snippet: r.content.slice(0, 200), title: r.doc_title, score: r.score })) };
  }

  async deleteDocument(organizationId: string, docId: string) {
    const doc = await this.prisma.knowledgeDocument.findFirst({ where: { id: docId, organizationId } });
    if (!doc) throw new NotFoundException();
    await this.prisma.knowledgeDocument.update({ where: { id: docId }, data: { deletedAt: new Date() } });
    return { ok: true };
  }

  private chunk(text: string): string[] {
    const chunks: string[] = [];
    let i = 0;
    while (i < text.length) { chunks.push(text.slice(i, i + CHUNK_SIZE)); i += CHUNK_SIZE - CHUNK_OVERLAP; }
    return chunks;
  }
  private detectType(mime: string): string { if (mime.includes('pdf')) return 'pdf'; if (mime.includes('word')) return 'docx'; if (mime.includes('sheet')) return 'xlsx'; if (mime.includes('text')) return 'txt'; if (mime.includes('markdown')) return 'md'; return 'unknown'; }
}
