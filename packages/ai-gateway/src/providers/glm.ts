// GLM Provider (智谱 GLM-4 / embedding-3)
// OpenAI-compatible API at https://open.bigmodel.cn/api/paas/v4
import { BaseProvider } from './base';
import type { ChatRequest, ChatResponse, StreamChunk } from '../types';
import { AiGatewayError } from '../types';
import { Provider } from '@matrixflow/shared';
import { ChatCompletionPayload, EmbeddingPayload, providerErrorMessage } from './openai-compatible.types';

export class GlmProvider extends BaseProvider {
  name = Provider.GLM;
  protected baseUrl: string;
  protected apiKey: string;
  private defaultModel: string;
  private timeoutMs: number;

  constructor(opts: { apiKey: string; baseUrl?: string; defaultModel?: string; timeoutMs?: number }) {
    super();
    this.apiKey = opts.apiKey;
    this.baseUrl = (opts.baseUrl ?? 'https://open.bigmodel.cn/api/paas/v4').replace(/\/$/, '');
    this.defaultModel = opts.defaultModel ?? 'glm-4-plus';
    this.timeoutMs = opts.timeoutMs ?? 60_000;
  }

  async chat(req: ChatRequest): Promise<ChatResponse> {
    return this.withRetry(async () => {
      const res = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify(this.toPayload(req, false)),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      if (!res.ok) throw await this.toError(res);
      const json = await res.json() as ChatCompletionPayload;
      return this.parseResponse(json, req);
    });
  }

  async *chatStream(req: ChatRequest): AsyncIterable<StreamChunk> {
    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(this.toPayload(req, true)),
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (!res.ok || !res.body) throw await this.toError(res);
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop() ?? '';
      for (const line of lines) {
        const t = line.trim();
        if (!t.startsWith('data:')) continue;
        const data = t.slice(5).trim();
        if (data === '[DONE]') { yield { delta: '', done: true }; return; }
        try {
          const j = JSON.parse(data) as ChatCompletionPayload;
          const delta = j.choices?.[0]?.delta?.content ?? '';
          if (delta) yield { delta, done: false };
          if (j.usage) yield { delta: '', done: false, usage: { inputTokens: j.usage.prompt_tokens ?? 0, outputTokens: j.usage.completion_tokens ?? 0, totalTokens: j.usage.total_tokens ?? 0 } };
        } catch { /* ignore partial */ }
      }
    }
    yield { delta: '', done: true };
  }

  async embedding(text: string, model = 'embedding-3'): Promise<{ vector: number[]; tokens: number }> {
    const res = await fetch(`${this.baseUrl}/embeddings`, {
      method: 'POST', headers: this.headers(),
      body: JSON.stringify({ model, input: text, encoding_format: 'float' }),
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (!res.ok) throw await this.toError(res);
    const j = await res.json() as EmbeddingPayload;
    const vector = j.data?.[0]?.embedding;
    if (!Array.isArray(vector)) throw new AiGatewayError('AI_PROVIDER_ERROR', 'GLM returned an invalid embedding payload');
    return { vector, tokens: j.usage?.total_tokens ?? Math.ceil(text.length / 4) };
  }

  private toPayload(req: ChatRequest, stream: boolean) {
    return {
      model: req.model || this.defaultModel,
      messages: req.messages,
      temperature: req.temperature ?? 0.7,
      max_tokens: req.maxTokens ?? 2000,
      stream,
      response_format: req.responseFormat === 'json_object' ? { type: 'json_object' } : undefined,
    };
  }

  private parseResponse(json: ChatCompletionPayload, req: ChatRequest): ChatResponse {
    const usage = json.usage ?? { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
    return {
      id: json.id ?? crypto.randomUUID(),
      model: req.model,
      content: json.choices?.[0]?.message?.content ?? '',
      usage: { inputTokens: usage.prompt_tokens ?? 0, outputTokens: usage.completion_tokens ?? 0, totalTokens: usage.total_tokens ?? 0 },
      costUsd: 0, // 由 gateway 按价目表计算后回填
      provider: this.name,
    };
  }

  private async toError(res: Response): Promise<AiGatewayError> {
    let msg = `GLM ${res.status}`;
    try { const payload: unknown = await res.json(); msg = providerErrorMessage(payload) ?? JSON.stringify(payload); } catch { /* response body is not JSON */ }
    return new AiGatewayError('AI_PROVIDER_ERROR', msg, res.status);
  }
}
