// AI Gateway · Provider 抽象基类
import type { ChatRequest, ChatResponse, StreamChunk, ProviderClient } from '../types';
import { AiGatewayError } from '../types';

export abstract class BaseProvider implements ProviderClient {
  abstract name: import('@matrixflow/shared').Provider;
  protected abstract baseUrl: string;
  protected abstract apiKey: string;

  abstract chat(req: ChatRequest): Promise<ChatResponse>;
  abstract chatStream(req: ChatRequest): AsyncIterable<StreamChunk>;
  abstract embedding(text: string, model?: string): Promise<{ vector: number[]; tokens: number }>;

  protected headers(): Record<string, string> {
    if (!this.apiKey) throw new AiGatewayError('AI_PROVIDER_ERROR', `${this.name} API key not set`);
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.apiKey}`,
    };
  }

  protected async withRetry<T>(fn: () => Promise<T>, maxRetry = 3, backoffMs = 500): Promise<T> {
    let lastErr: unknown;
    for (let i = 0; i < maxRetry; i++) {
      try { return await fn(); }
      catch (e) {
        lastErr = e;
        if (e instanceof AiGatewayError && e.status === 429) {
          await new Promise((r) => setTimeout(r, backoffMs * 2 ** i));
          continue;
        }
        if (i === maxRetry - 1) break;
        await new Promise((r) => setTimeout(r, backoffMs * 2 ** i));
      }
    }
    throw lastErr instanceof Error ? lastErr : new AiGatewayError('AI_PROVIDER_ERROR', String(lastErr));
  }
}
