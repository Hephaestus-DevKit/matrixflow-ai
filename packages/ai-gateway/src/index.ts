// AI Gateway 主入口 · 路由 + fallback + 计量 + 缓存
import type { ChatRequest, ChatResponse, StreamChunk, ProviderClient } from './types';
import { AiGatewayError } from './types';
import { createProviders } from './providers';
import { Provider } from '@matrixflow/shared';

export interface GatewayOptions {
  glm?: { apiKey: string; baseUrl?: string; defaultModel?: string; timeoutMs?: number };
  openai?: { apiKey: string; baseUrl?: string; defaultModel?: string; timeoutMs?: number };
  fallbackChain?: Provider[]; // 默认 [GLM, OPENAI]
  onUsage?: (res: ChatResponse, req: ChatRequest) => void;
}

export class AiGateway {
  private providers: Record<Provider, ProviderClient | null>;
  private chain: Provider[];
  private onUsage?: (res: ChatResponse, req: ChatRequest) => void;

  constructor(opts: GatewayOptions) {
    if (!opts || Object.keys(opts).length === 0) {
      throw new AiGatewayError('AI_PROVIDER_ERROR', 'No AI provider configured');
    }
    this.providers = createProviders(opts);
    this.onUsage = opts.onUsage;
    this.chain = opts.fallbackChain ?? [Provider.GLM, Provider.OPENAI].filter((p) => this.providers[p]);
    // Note: we do NOT throw here - allow app to start without API keys (dev mode)
  }

  async chat(req: ChatRequest): Promise<ChatResponse> {
    let lastErr: unknown;
    for (const name of this.chain) {
      const p = this.providers[name];
      if (!p) continue;
      try {
        const res = await p.chat(req);
        this.onUsage?.(res, req);
        return res;
      } catch (e) { lastErr = e; }
    }
    throw lastErr instanceof Error ? lastErr : new AiGatewayError('AI_PROVIDER_ERROR', 'All providers failed');
  }

  async *chatStream(req: ChatRequest): AsyncIterable<StreamChunk> {
    // 流式只走首选 provider，失败则降级为非流式
    const primary = this.providers[this.chain[0]];
    if (!primary) throw new AiGatewayError('AI_PROVIDER_ERROR', 'No primary provider');
    try {
      for await (const chunk of primary.chatStream(req)) {
        yield chunk;
        if (chunk.usage) {
          this.onUsage?.({ ...({} as ChatResponse), usage: chunk.usage, costUsd: 0, provider: this.chain[0] } as ChatResponse, req);
        }
      }
    } catch {
      // 降级非流式
      const res = await this.chat({ ...req, stream: false });
      yield { delta: res.content, done: false, usage: res.usage };
      yield { delta: '', done: true };
    }
  }

  async embedding(text: string, model?: string): Promise<{ vector: number[]; tokens: number }> {
    for (const name of this.chain) {
      const p = this.providers[name];
      if (p) try { return await p.embedding(text, model); } catch { /* try next */ }
    }
    throw new AiGatewayError('AI_PROVIDER_ERROR', 'No embedding provider available');
  }
}

export * from './types';
export * from './providers';
export * from './prompt';
