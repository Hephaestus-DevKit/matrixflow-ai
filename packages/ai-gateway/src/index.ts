// AI Gateway 主入口 · 路由 + fallback + 计量 + 缓存
import type { ChatRequest, ChatResponse, StreamChunk, ProviderClient } from './types';
import { AiGatewayError } from './types';
import { createProviders } from './providers';
import { Provider } from '@matrixflow/shared';

export interface GatewayOptions {
  glm?: {
    apiKey: string;
    baseUrl?: string;
    defaultModel?: string;
    embeddingModel?: string;
    timeoutMs?: number;
  };
  openai?: {
    apiKey: string;
    baseUrl?: string;
    defaultModel?: string;
    embeddingModel?: string;
    timeoutMs?: number;
  };
  fallbackChain?: Provider[]; // 默认 [GLM, OPENAI]
  onUsage?: (res: ChatResponse, req: ChatRequest) => void;
}

export class AiGateway {
  private providers: Record<Provider, ProviderClient | null>;
  private chain: Provider[];
  private onUsage?: (res: ChatResponse, req: ChatRequest) => void;
  private chatModels: Partial<Record<Provider, string>>;
  private embeddingModels: Partial<Record<Provider, string>>;

  constructor(opts: GatewayOptions) {
    if (!opts || Object.keys(opts).length === 0) {
      throw new AiGatewayError('AI_PROVIDER_ERROR', 'No AI provider configured');
    }
    this.providers = createProviders(opts);
    this.onUsage = opts.onUsage;
    this.chatModels = {
      [Provider.GLM]: opts.glm?.defaultModel,
      [Provider.OPENAI]: opts.openai?.defaultModel,
    };
    this.embeddingModels = {
      [Provider.GLM]: opts.glm?.embeddingModel,
      [Provider.OPENAI]: opts.openai?.embeddingModel,
    };
    this.chain =
      opts.fallbackChain ?? [Provider.GLM, Provider.OPENAI].filter((p) => this.providers[p]);
    // Note: we do NOT throw here - allow app to start without API keys (dev mode)
  }

  async chat(req: ChatRequest): Promise<ChatResponse> {
    let lastErr: unknown;
    for (const name of this.chain) {
      const p = this.providers[name];
      if (!p) continue;
      try {
        const providerRequest = this.forProvider(req, name);
        const res = await p.chat(providerRequest);
        this.onUsage?.(res, req);
        return res;
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr instanceof Error
      ? lastErr
      : new AiGatewayError('AI_PROVIDER_ERROR', 'All providers failed');
  }

  async *chatStream(req: ChatRequest): AsyncIterable<StreamChunk> {
    // 流式只走首选 provider，失败则降级为非流式
    const primary = this.providers[this.chain[0]];
    if (!primary) throw new AiGatewayError('AI_PROVIDER_ERROR', 'No primary provider');
    try {
      const providerName = this.chain[0];
      const providerRequest = this.forProvider(req, providerName);
      for await (const chunk of primary.chatStream(providerRequest)) {
        yield { ...chunk, provider: providerName, model: providerRequest.model };
        if (chunk.usage) {
          this.onUsage?.(
            {
              ...({} as ChatResponse),
              usage: chunk.usage,
              costUsd: 0,
              provider: this.chain[0],
            } as ChatResponse,
            req,
          );
        }
      }
    } catch (error) {
      if (req.signal?.aborted) throw error;
      // 降级非流式
      const res = await this.chat({ ...req, stream: false });
      yield {
        delta: res.content,
        done: false,
        usage: res.usage,
        provider: res.provider,
        model: res.model,
      };
      yield { delta: '', done: true, provider: res.provider, model: res.model };
    }
  }

  async embedding(
    text: string,
  ): Promise<{ vector: number[]; tokens: number; provider: Provider; model: string }> {
    for (const name of this.chain) {
      const p = this.providers[name];
      if (p)
        try {
          const model = this.embeddingModels[name];
          const result = await p.embedding(text, model);
          return { ...result, provider: name, model: model ?? '' };
        } catch {
          /* try next */
        }
    }
    throw new AiGatewayError('AI_PROVIDER_ERROR', 'No embedding provider available');
  }

  private forProvider(req: ChatRequest, provider: Provider): ChatRequest {
    return {
      ...req,
      model: req.providerModels?.[provider] ?? this.chatModels[provider] ?? req.model,
    };
  }
}

export * from './types';
export * from './providers';
export * from './prompt';
