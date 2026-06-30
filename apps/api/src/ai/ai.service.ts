import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { AiGateway, AiGatewayError, compilePrompt } from '@matrixflow/ai-gateway';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { AuditService } from '../common/audit.service';
import { ErrorCode } from '@matrixflow/shared';

@Injectable()
export class AiService {
  constructor(
    private gateway: AiGateway,
    private prisma: PrismaService,
    private redis: RedisService,
    private audit: AuditService,
  ) {}

  // 用 prompt key 调用，自动注入模板、计量、缓存
  async runPrompt(args: { promptKey: string; variables: Record<string, unknown>; organizationId: string; userId: string; agentId?: string; responseFormat?: 'text' | 'json_object' }) {
    const tpl = await this.prisma.promptTemplate.findFirst({ where: { key: args.promptKey, isLatest: true } });
    if (!tpl) throw new NotFoundException(`Prompt template ${args.promptKey} not found`);

    const compiled = compilePrompt({ systemPrompt: tpl.systemPrompt, userPromptTemplate: tpl.userPromptTemplate }, args.variables);

    // 限流：按组织每分钟 60 次
    const rate = await this.redis.incr(`rate:${args.organizationId}:ai`, 60);
    if (rate > Number(process.env.AI_RATE_LIMIT_PER_MIN ?? '60')) throw new BadRequestException(ErrorCode.AI_RATE_LIMITED);

    // 缓存（仅非流式 + 文本输出）
    const cacheKey = `ai:${args.promptKey}:${hash(JSON.stringify(args.variables))}`;
    const cached = await this.redis.get<any>(cacheKey);
    if (cached) { await this.recordUsage({ ...cached, cached: true }, args); return cached; }

    try {
      const res = await this.gateway.chat({
        model: tpl.systemPrompt ? 'glm-4-plus' : 'glm-4-plus',
        messages: [{ role: 'system', content: compiled.systemPrompt }, { role: 'user', content: compiled.userPrompt }],
        responseFormat: args.responseFormat ?? (tpl.outputSchema ? 'json_object' : 'text'),
        metadata: { organizationId: args.organizationId, agentId: args.agentId, promptKey: args.promptKey },
      });
      const cost = await this.computeCost(res.provider, res.model, res.usage.inputTokens, res.usage.outputTokens);
      const out = { content: res.content, usage: res.usage, costUsd: cost, cached: false };
      if (!args.responseFormat || args.responseFormat === 'text') await this.redis.set(cacheKey, out, Number(process.env.AI_CACHE_TTL_SECONDS ?? '3600'));
      await this.recordUsage({ ...res, costUsd: cost, provider: res.provider }, args);
      return out;
    } catch (e) {
      if (e instanceof AiGatewayError) throw new BadRequestException(ErrorCode.AI_PROVIDER_ERROR);
      throw e;
    }
  }

  // 流式输出 (SSE 用)
  async *stream(args: { promptKey: string; variables: Record<string, unknown>; organizationId: string; userId: string; agentId?: string }) {
    const tpl = await this.prisma.promptTemplate.findFirst({ where: { key: args.promptKey, isLatest: true } });
    if (!tpl) throw new NotFoundException(`Prompt template ${args.promptKey} not found`);
    const compiled = compilePrompt({ systemPrompt: tpl.systemPrompt, userPromptTemplate: tpl.userPromptTemplate }, args.variables);
    yield* this.gateway.chatStream({
      model: 'glm-4-plus',
      messages: [{ role: 'system', content: compiled.systemPrompt }, { role: 'user', content: compiled.userPrompt }],
      responseFormat: tpl.outputSchema ? 'json_object' : 'text',
      metadata: { organizationId: args.organizationId, agentId: args.agentId, promptKey: args.promptKey },
    });
  }

  async embedding(text: string, organizationId: string) {
    const r = await this.gateway.embedding(text, process.env.EMBEDDING_MODEL);
    await this.recordUsage({ content: '', usage: { inputTokens: r.tokens, outputTokens: 0, totalTokens: r.tokens }, costUsd: 0, provider: 'glm' as any, model: process.env.EMBEDDING_MODEL!, id: '' } as any, { organizationId, userId: '', promptKey: 'embedding' });
    return r;
  }

  private async recordUsage(res: any, args: { organizationId: string; userId: string; agentId?: string; promptKey?: string }) {
    const cost = res.costUsd ?? 0;
    await this.prisma.tokenUsage.create({ data: { organizationId: args.organizationId, agentId: args.agentId, provider: String(res.provider ?? 'glm'), model: res.model ?? 'glm-4-plus', inputTokens: res.usage?.inputTokens ?? 0, outputTokens: res.usage?.outputTokens ?? 0, cacheHit: !!res.cached, costUsd: cost, metadata: { promptKey: args.promptKey, userId: args.userId } as any } }).catch(() => {});
    await this.prisma.usageRecord.create({ data: { organizationId: args.organizationId, metric: 'ai_call', value: 1, metadata: { promptKey: args.promptKey } as any } }).catch(() => {});
    if (!res.cached && res.usage) {
      await this.prisma.usageRecord.create({ data: { organizationId: args.organizationId, metric: 'token_input', value: res.usage.inputTokens ?? 0 } }).catch(() => {});
      await this.prisma.usageRecord.create({ data: { organizationId: args.organizationId, metric: 'token_output', value: res.usage.outputTokens ?? 0 } }).catch(() => {});
    }
  }

  private async computeCost(provider: string, model: string, inputTokens: number, outputTokens: number): Promise<number> {
    const cost = await this.prisma.modelCost.findFirst({ where: { provider, model, effectiveFrom: { lte: new Date() }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: new Date() } }] }, orderBy: { effectiveFrom: 'desc' } });
    if (!cost) return 0;
    return (inputTokens / 1000) * cost.inputPer1kUsd + (outputTokens / 1000) * cost.outputPer1kUsd;
  }
}

function hash(s: string): string { let h = 0; for (let i = 0; i < s.length; i++) { h = ((h << 5) - h) + s.charCodeAt(i); h |= 0; } return h.toString(16); }
