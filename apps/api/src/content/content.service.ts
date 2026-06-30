import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';
import { productDataSchema } from '@matrixflow/shared';
import { AuditService } from '../common/audit.service';

// 15 类内容生成器 → prompt key 映射
const CONTENT_PROMPT_MAP: Record<string, string> = {
  product_title: 'product_title',
  listing: 'product_listing',
  faq: 'product_faq',
  customer_service: 'customer_service_reply',
  tiktok_script: 'tiktok_script',
  instagram: 'instagram_caption',
  facebook_ad: 'facebook_ad',
  email_marketing: 'email_marketing',
  seo_blog: 'seo_blog',
  landing_page: 'landing_page_copy',
  multilingual: 'multilingual_translate',
  brand_voice: 'brand_voice_rewrite',
};

@Injectable()
export class ContentService {
  constructor(private prisma: PrismaService, private ai: AiService, private audit: AuditService) {}

  async createProject(organizationId: string, userId: string, input: { name: string; productData: unknown; brandVoiceId?: string }) {
    const product = productDataSchema.parse(input.productData);
    return this.prisma.contentProject.create({ data: { organizationId, name: input.name, productData: product as any, brandVoiceId: input.brandVoiceId } });
  }

  async listProjects(organizationId: string) {
    return this.prisma.contentProject.findMany({ where: { organizationId, deletedAt: null }, include: { _count: { select: { items: true } } }, orderBy: { createdAt: 'desc' } });
  }

  async getProject(organizationId: string, id: string) {
    const p = await this.prisma.contentProject.findFirst({ where: { id, organizationId, deletedAt: null }, include: { items: true, brandVoice: true } as any });
    if (!p) throw new NotFoundException();
    return p;
  }

  // 生成单类内容
  async generate(organizationId: string, userId: string, projectId: string, type: string, variables: Record<string, unknown>) {
    const project = await this.prisma.contentProject.findFirst({ where: { id: projectId, organizationId } });
    if (!project) throw new NotFoundException('Project not found');
    const promptKey = CONTENT_PROMPT_MAP[type];
    if (!promptKey) throw new NotFoundException(`Unknown content type: ${type}`);

    const vars = { ...variables, productJson: project.productData, brandVoiceId: project.brandVoiceId };
    const result = await this.ai.runPrompt({ promptKey, variables: vars, organizationId, userId, responseFormat: 'json_object' });

    let parsed: any = result.content;
    try { parsed = JSON.parse(result.content); } catch { /* keep raw */ }

    const item = await this.prisma.contentItem.create({ data: { projectId, organizationId, type, title: typeof parsed === 'object' && parsed?.title ? parsed.title : type, body: { raw: result.content, parsed } as any, metadata: { usage: result.usage, cost: result.costUsd } as any } });
    await this.audit.log({ action: 'content.generate', userId, organizationId, resource: 'content', resourceId: item.id, metadata: { type, promptKey } as any });
    return { itemId: item.id, content: parsed, usage: result.usage, cost: result.costUsd };
  }

  // 一键生成全部 15 类（MVP 核心：上传商品→全量产出）
  async generateAll(organizationId: string, userId: string, projectId: string, language = 'en') {
    const types = Object.keys(CONTENT_PROMPT_MAP);
    const results: Record<string, unknown> = {};
    // 顺序执行避免限流；生产可并发分批
    for (const type of types) {
      try { results[type] = await this.generate(organizationId, userId, projectId, type, { language, platform: type === 'product_title' ? 'amazon' : undefined }); }
      catch (e) { results[type] = { error: (e as Error).message }; }
    }
    return results;
  }

  async listItems(organizationId: string, projectId: string, type?: string) {
    return this.prisma.contentItem.findMany({ where: { projectId, organizationId, deletedAt: null, ...(type ? { type } : {}) }, orderBy: { createdAt: 'desc' } });
  }

  async saveVersion(organizationId: string, itemId: string, body: { content: string; changeNote?: string }, userId: string) {
    const item = await this.prisma.contentItem.findFirst({ where: { id: itemId, organizationId } });
    if (!item) throw new NotFoundException();
    const lastVer = await this.prisma.contentVersion.count({ where: { itemId } });
    return this.prisma.contentVersion.create({ data: { itemId, version: lastVer + 1, body: { content: body.content } as any, changeNote: body.changeNote, createdBy: userId } });
  }

  async score(organizationId: string, itemId: string, dimension: string) {
    const item = await this.prisma.contentItem.findFirst({ where: { id: itemId, organizationId } });
    if (!item) throw new NotFoundException();
    const result = await this.ai.runPrompt({ promptKey: 'content_score', variables: { content: (item.body as any).raw, dimension }, organizationId, userId: '', responseFormat: 'json_object' });
    const parsed = JSON.parse(result.content);
    return this.prisma.contentScore.upsert({ where: { itemId_dimension: { itemId, dimension } }, update: { score: parsed.score, reason: parsed.reason }, create: { itemId, dimension, score: parsed.score, reason: parsed.reason } });
  }
}
