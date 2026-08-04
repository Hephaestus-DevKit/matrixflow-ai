import {
  Injectable,
  NotFoundException,
  BadRequestException,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { AiGateway, AiGatewayError, compilePrompt, type StreamChunk } from '@matrixflow/ai-gateway';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { AuditService } from '../common/audit.service';
import { ErrorCode, Provider } from '@matrixflow/shared';
import { createHash } from 'crypto';

interface PromptArgs {
  promptKey: string;
  variables: Record<string, unknown>;
  organizationId: string;
  userId: string;
  agentId?: string;
  responseFormat?: 'text' | 'json_object';
}

interface MeteredResult {
  usage: { inputTokens: number; outputTokens: number; totalTokens?: number };
  costUsd?: number;
  provider?: string;
  model?: string;
  cached?: boolean;
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  constructor(
    private gateway: AiGateway,
    private prisma: PrismaService,
    private redis: RedisService,
    private audit: AuditService,
  ) {}

  // 用 prompt key 调用，自动注入模板、计量、缓存
  async runPrompt(args: PromptArgs) {
    const tpl = await this.prisma.promptTemplate.findFirst({
      where: { key: args.promptKey, isLatest: true },
    });
    if (!tpl) throw new NotFoundException(`Prompt template ${args.promptKey} not found`);

    if (process.env.PROMPT_INJECTION_DETECTION !== 'off')
      this.assertNoPromptInjection(args.variables);
    const compiled = compilePrompt(
      { systemPrompt: tpl.systemPrompt, userPromptTemplate: tpl.userPromptTemplate },
      args.variables,
    );

    // 限流：按组织每分钟 60 次
    await this.assertWithinRateLimit(args.organizationId);

    // 缓存（仅非流式 + 文本输出）
    // Cache entries must be tenant-scoped. Otherwise identical prompts from
    // two organizations can return one organization's private content.
    const cacheKey = this.cacheKey(args, tpl.id, tpl.version);
    const cached = await this.redis.get<{
      content: string;
      usage: MeteredResult['usage'];
      costUsd: number;
      provider?: string;
      model?: string;
    }>(cacheKey);
    if (cached) {
      if (tpl.outputSchema) this.assertValidOutput(cached.content, tpl.outputSchema);
      await this.recordUsage({ ...cached, cached: true }, args);
      return cached;
    }

    try {
      const res = await this.gateway.chat({
        model: 'default',
        providerModels: this.providerModels(),
        messages: [
          { role: 'system', content: compiled.systemPrompt },
          { role: 'user', content: compiled.userPrompt },
        ],
        responseFormat: args.responseFormat ?? (tpl.outputSchema ? 'json_object' : 'text'),
        metadata: {
          organizationId: args.organizationId,
          agentId: args.agentId,
          promptKey: args.promptKey,
        },
      });
      const cost = await this.computeCost(
        res.provider,
        res.model,
        res.usage.inputTokens,
        res.usage.outputTokens,
      );
      const out = { content: res.content, usage: res.usage, costUsd: cost, cached: false };
      if (tpl.outputSchema) this.assertValidOutput(out.content, tpl.outputSchema);
      if (!args.responseFormat || args.responseFormat === 'text')
        await this.redis.set(cacheKey, out, Number(process.env.AI_CACHE_TTL_SECONDS ?? '3600'));
      await this.recordUsage({ ...res, costUsd: cost, provider: res.provider }, args);
      return out;
    } catch (e) {
      if (e instanceof AiGatewayError) {
        throw new HttpException(
          e.code === 'AI_TIMEOUT' ? ErrorCode.AI_TIMEOUT : ErrorCode.AI_PROVIDER_ERROR,
          e.code === 'AI_TIMEOUT' ? HttpStatus.GATEWAY_TIMEOUT : HttpStatus.BAD_GATEWAY,
        );
      }
      throw e;
    }
  }

  // 流式输出 (SSE 用)
  async *stream(args: PromptArgs, signal?: AbortSignal): AsyncIterable<StreamChunk> {
    const tpl = await this.prisma.promptTemplate.findFirst({
      where: { key: args.promptKey, isLatest: true },
    });
    if (!tpl) throw new NotFoundException(`Prompt template ${args.promptKey} not found`);
    if (process.env.PROMPT_INJECTION_DETECTION !== 'off')
      this.assertNoPromptInjection(args.variables);
    await this.assertWithinRateLimit(args.organizationId);
    const compiled = compilePrompt(
      { systemPrompt: tpl.systemPrompt, userPromptTemplate: tpl.userPromptTemplate },
      args.variables,
    );
    let content = '';
    let usage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
    let provider: Provider = Provider.GLM;
    let model = 'unknown';
    let accounted = false;
    const bufferOutput = Boolean(tpl.outputSchema);
    try {
      for await (const chunk of this.gateway.chatStream({
        model: 'default',
        providerModels: this.providerModels(),
        messages: [
          { role: 'system', content: compiled.systemPrompt },
          { role: 'user', content: compiled.userPrompt },
        ],
        responseFormat: args.responseFormat ?? (tpl.outputSchema ? 'json_object' : 'text'),
        metadata: {
          organizationId: args.organizationId,
          agentId: args.agentId,
          promptKey: args.promptKey,
        },
        signal,
      })) {
        content += chunk.delta;
        if (chunk.usage) usage = { ...chunk.usage };
        if (chunk.provider) provider = chunk.provider;
        if (chunk.model) model = chunk.model;
        if (!bufferOutput && !chunk.done) yield chunk;
      }
      if (tpl.outputSchema) this.assertValidOutput(content, tpl.outputSchema);
      const costUsd = await this.computeCost(
        provider,
        model,
        usage.inputTokens,
        usage.outputTokens,
      );
      await this.recordUsage({ usage, costUsd, provider, model }, args);
      accounted = true;
      if (bufferOutput) yield { delta: content, done: false, usage, provider, model };
      yield { delta: '', done: true, usage, provider, model };
    } finally {
      if (!accounted && (content || usage.totalTokens > 0)) {
        await this.recordUsage({ usage, provider, model }, args).catch((error) => {
          this.logger.error(`Unable to account interrupted AI stream: ${(error as Error).message}`);
        });
      }
    }
  }

  async embedding(text: string, organizationId: string) {
    const r = await this.gateway.embedding(text);
    await this.recordUsage(
      {
        usage: { inputTokens: r.tokens, outputTokens: 0, totalTokens: r.tokens },
        costUsd: 0,
        provider: r.provider,
        model: r.model,
      },
      { organizationId, userId: '', promptKey: 'embedding' },
    );
    return r;
  }

  private async recordUsage(
    res: MeteredResult,
    args: Pick<PromptArgs, 'organizationId' | 'userId' | 'agentId' | 'promptKey'>,
  ) {
    const cost = res.costUsd ?? 0;
    await this.prisma.$transaction(async (tx) => {
      await tx.tokenUsage.create({
        data: {
          organizationId: args.organizationId,
          agentId: args.agentId,
          provider: String(res.provider ?? 'unknown'),
          model: res.model ?? 'unknown',
          inputTokens: res.usage.inputTokens,
          outputTokens: res.usage.outputTokens,
          cacheHit: !!res.cached,
          costUsd: cost,
          metadata: { promptKey: args.promptKey, userId: args.userId },
        },
      });
      await tx.usageRecord.create({
        data: {
          organizationId: args.organizationId,
          metric: 'ai_call',
          value: 1,
          metadata: { promptKey: args.promptKey },
        },
      });
      if (!res.cached) {
        await tx.usageRecord.create({
          data: {
            organizationId: args.organizationId,
            metric: 'token_input',
            value: res.usage.inputTokens,
          },
        });
        await tx.usageRecord.create({
          data: {
            organizationId: args.organizationId,
            metric: 'token_output',
            value: res.usage.outputTokens,
          },
        });
      }
    });
  }

  private async computeCost(
    provider: string,
    model: string,
    inputTokens: number,
    outputTokens: number,
  ): Promise<number> {
    const cost = await this.prisma.modelCost.findFirst({
      where: {
        provider,
        model,
        effectiveFrom: { lte: new Date() },
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: new Date() } }],
      },
      orderBy: { effectiveFrom: 'desc' },
    });
    if (!cost) return 0;
    return (inputTokens / 1000) * cost.inputPer1kUsd + (outputTokens / 1000) * cost.outputPer1kUsd;
  }

  private assertNoPromptInjection(variables: Record<string, unknown>) {
    const text = JSON.stringify(variables).toLowerCase();
    const highConfidencePatterns = [
      'ignore all previous instructions',
      'ignore previous system instructions',
      'reveal the system prompt',
      '<system>',
      'begin system prompt',
      'developer message:',
    ];
    if (highConfidencePatterns.some((pattern) => text.includes(pattern))) {
      throw new BadRequestException('Potential prompt injection detected');
    }
  }

  private async assertWithinRateLimit(organizationId: string) {
    const rate = await this.redis.incr(`rate:${organizationId}:ai`, 60);
    if (rate > Number(process.env.AI_RATE_LIMIT_PER_MIN ?? '60')) {
      throw new HttpException(ErrorCode.AI_RATE_LIMITED, HttpStatus.TOO_MANY_REQUESTS);
    }
  }

  private providerModels(): Partial<Record<Provider, string>> {
    return {
      [Provider.GLM]: process.env.GLM_DEFAULT_MODEL ?? 'glm-4-plus',
      [Provider.OPENAI]: process.env.OPENAI_DEFAULT_MODEL ?? 'gpt-4o-mini',
    };
  }

  private cacheKey(args: PromptArgs, templateId: string, templateVersion: number): string {
    const digest = createHash('sha256')
      .update(
        stableStringify({
          templateId,
          templateVersion,
          variables: args.variables,
          responseFormat: args.responseFormat,
          providerModels: this.providerModels(),
        }),
      )
      .digest('hex');
    return `ai:${args.organizationId}:${args.promptKey}:${digest}`;
  }

  private assertValidOutput(content: string, schemaValue: unknown) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      throw new BadRequestException(ErrorCode.AI_INVALID_OUTPUT);
    }
    try {
      this.validateSchema(parsed, schemaValue, '$');
    } catch {
      throw new BadRequestException(ErrorCode.AI_INVALID_OUTPUT);
    }
  }

  private validateSchema(value: unknown, schemaValue: unknown, path: string) {
    if (!schemaValue || typeof schemaValue !== 'object' || Array.isArray(schemaValue)) return;
    const schema = schemaValue as Record<string, unknown>;
    if (Array.isArray(schema.enum) && !schema.enum.some((candidate) => candidate === value))
      throw new Error(`${path} is not in enum`);
    if (schema.type === 'object') {
      if (!value || typeof value !== 'object' || Array.isArray(value))
        throw new Error(`${path} must be an object`);
      const record = value as Record<string, unknown>;
      for (const required of Array.isArray(schema.required) ? schema.required : []) {
        if (typeof required === 'string' && !(required in record))
          throw new Error(`${path}.${required} is required`);
      }
      if (
        schema.properties &&
        typeof schema.properties === 'object' &&
        !Array.isArray(schema.properties)
      ) {
        for (const [key, childSchema] of Object.entries(
          schema.properties as Record<string, unknown>,
        )) {
          if (key in record) this.validateSchema(record[key], childSchema, `${path}.${key}`);
        }
      }
    } else if (schema.type === 'array') {
      if (!Array.isArray(value)) throw new Error(`${path} must be an array`);
      value.forEach((entry, index) =>
        this.validateSchema(entry, schema.items, `${path}[${index}]`),
      );
    } else if (schema.type === 'string' && typeof value !== 'string')
      throw new Error(`${path} must be a string`);
    else if (schema.type === 'number' && typeof value !== 'number')
      throw new Error(`${path} must be a number`);
    else if (schema.type === 'integer' && !Number.isInteger(value))
      throw new Error(`${path} must be an integer`);
    else if (schema.type === 'boolean' && typeof value !== 'boolean')
      throw new Error(`${path} must be a boolean`);
  }
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, child]) => `${JSON.stringify(key)}:${stableStringify(child)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}
