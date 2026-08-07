import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';
import { createContentProjectSchema } from '@matrixflow/shared';
import { AuditService } from '../common/audit.service';
import { asJsonRecord, jsonString, toInputJson } from '../common/prisma-json';

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
  constructor(
    private prisma: PrismaService,
    private ai: AiService,
    private audit: AuditService,
  ) {}

  async createProject(organizationId: string, userId: string, rawInput: unknown) {
    const input = createContentProjectSchema.parse(rawInput);
    if (input.brandVoiceId) {
      const voice = await this.prisma.brandVoice.findFirst({
        where: { id: input.brandVoiceId, organizationId, isActive: true },
        select: { id: true },
      });
      if (!voice) throw new NotFoundException('Brand voice not found');
    }
    const project = await this.prisma.contentProject.create({
      data: {
        organizationId,
        name: input.name,
        productData: toInputJson(input.productData, 'productData'),
        brandVoiceId: input.brandVoiceId,
      },
    });
    await this.audit.log({
      action: 'content.project.create',
      userId,
      organizationId,
      resource: 'contentProject',
      resourceId: project.id,
    });
    return project;
  }

  async listProjects(organizationId: string) {
    return this.prisma.contentProject.findMany({
      where: { organizationId, deletedAt: null },
      include: { _count: { select: { items: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getProject(organizationId: string, id: string) {
    const p = await this.prisma.contentProject.findFirst({
      where: { id, organizationId, deletedAt: null },
      include: { items: true, brandVoice: true },
    });
    if (!p) throw new NotFoundException();
    return p;
  }

  // 生成单类内容
  async generate(
    organizationId: string,
    userId: string,
    projectId: string,
    type: string,
    variables: Record<string, unknown>,
  ) {
    const project = await this.prisma.contentProject.findFirst({
      where: { id: projectId, organizationId },
    });
    if (!project) throw new NotFoundException('Project not found');
    const promptKey = CONTENT_PROMPT_MAP[type];
    if (!promptKey) throw new NotFoundException(`Unknown content type: ${type}`);

    // 基于项目商品信息动态生成智能缺省变量
    const pData = asJsonRecord(project.productData);
    const pTitle = jsonString(pData, 'title') ?? project.name ?? 'Product';
    const pDesc = jsonString(pData, 'description') ?? 'Quality product';

    const defaultVariables: Record<string, unknown> = {};
    if (type === 'product_title') {
      defaultVariables.brand = jsonString(pData, 'brand') ?? 'Generic';
      defaultVariables.platform = variables.platform || 'amazon';
      defaultVariables.maxLength = 150;
    } else if (type === 'listing') {
      defaultVariables.platform = variables.platform || 'amazon';
    } else if (type === 'tiktok_script') {
      defaultVariables.audience = 'social media shoppers';
      defaultVariables.duration = 30;
    } else if (type === 'instagram') {
      defaultVariables.style = 'engaging and trendy';
    } else if (type === 'facebook_ad') {
      defaultVariables.audience = 'online shoppers';
      defaultVariables.objective = 'conversion';
    } else if (type === 'email_marketing') {
      defaultVariables.emailType = 'promotional discount';
      defaultVariables.audience = 'subscribers';
    } else if (type === 'seo_blog') {
      defaultVariables.topic = `Why ${pTitle} is the best choice for your daily needs`;
      defaultVariables.keywords = `${pTitle}, best ${pTitle}, ${pTitle} review`;
      defaultVariables.audience = 'consumers';
    } else if (type === 'customer_service') {
      defaultVariables.history = `Customer: Hi, I saw ${pTitle} and wanted to ask about its features.\nAgent: Hello! I'd be happy to tell you about ${pTitle}. It has several key features including: ${pDesc}`;
    } else if (type === 'landing_page') {
      defaultVariables.audience = 'potential buyers';
    } else if (type === 'multilingual') {
      defaultVariables.sourceText = `${pTitle}: ${pDesc}`;
      defaultVariables.sourceLanguage = 'Chinese';
      defaultVariables.targetLanguage = 'English';
    } else if (type === 'brand_voice') {
      defaultVariables.sourceText = `${pTitle}: ${pDesc}`;
      defaultVariables.brandVoiceRules = {
        formality: 3,
        humor: 3,
        emojiFrequency: 'medium',
        toneDescription: 'Friendly, warm, and professional',
      };
    }

    const vars = {
      ...defaultVariables,
      ...variables,
      productJson: project.productData,
      brandVoiceId: project.brandVoiceId,
    };
    const result = await this.ai.runPrompt({
      promptKey,
      variables: vars,
      organizationId,
      userId,
      responseFormat: 'json_object',
    });

    let parsed: unknown = result.content;
    try {
      parsed = JSON.parse(result.content);
    } catch {
      /* keep raw */
    }

    const item = await this.prisma.contentItem.create({
      data: {
        projectId,
        organizationId,
        type,
        title: jsonString(parsed, 'title') ?? type,
        body: toInputJson({ raw: result.content, parsed }, 'content body'),
        metadata: toInputJson({ usage: result.usage, cost: result.costUsd }, 'content metadata'),
      },
    });
    await this.audit.log({
      action: 'content.generate',
      userId,
      organizationId,
      resource: 'content',
      resourceId: item.id,
      metadata: { type, promptKey },
    });
    return { itemId: item.id, content: parsed, usage: result.usage, cost: result.costUsd };
  }

  // 一键生成全部 15 类（MVP 核心：上传商品→全量产出）
  async generateAll(organizationId: string, userId: string, projectId: string, language = 'en') {
    const types = Object.keys(CONTENT_PROMPT_MAP);
    const results: Record<string, unknown> = {};
    // 顺序执行避免限流；生产可并发分批
    for (const type of types) {
      try {
        results[type] = await this.generate(organizationId, userId, projectId, type, {
          language,
          platform: type === 'product_title' ? 'amazon' : undefined,
        });
      } catch (e) {
        results[type] = { error: (e as Error).message };
      }
    }
    return results;
  }

  async listItems(organizationId: string, projectId: string, type?: string) {
    return this.prisma.contentItem.findMany({
      where: { projectId, organizationId, deletedAt: null, ...(type ? { type } : {}) },
      orderBy: { createdAt: 'desc' },
    });
  }

  async saveVersion(
    organizationId: string,
    itemId: string,
    body: { content: string; changeNote?: string },
    userId: string,
  ) {
    const item = await this.prisma.contentItem.findFirst({ where: { id: itemId, organizationId } });
    if (!item) throw new NotFoundException();
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`content-version:${itemId}`}))`;
      const latest = await tx.contentVersion.findFirst({
        where: { itemId },
        orderBy: { version: 'desc' },
        select: { version: true },
      });
      return tx.contentVersion.create({
        data: {
          itemId,
          version: (latest?.version ?? 0) + 1,
          body: { content: body.content },
          changeNote: body.changeNote,
          createdBy: userId,
        },
      });
    });
  }

  async score(organizationId: string, itemId: string, dimension: string) {
    const item = await this.prisma.contentItem.findFirst({ where: { id: itemId, organizationId } });
    if (!item) throw new NotFoundException();
    const result = await this.ai.runPrompt({
      promptKey: 'content_score',
      variables: { content: jsonString(item.body, 'raw') ?? '', dimension },
      organizationId,
      userId: '',
      responseFormat: 'json_object',
    });
    const parsed = asJsonRecord(JSON.parse(result.content));
    const score = Number(parsed.score);
    const reason = typeof parsed.reason === 'string' ? parsed.reason : '';
    return this.prisma.contentScore.upsert({
      where: { itemId_dimension: { itemId, dimension } },
      update: { score, reason },
      create: { itemId, dimension, score, reason },
    });
  }
}
