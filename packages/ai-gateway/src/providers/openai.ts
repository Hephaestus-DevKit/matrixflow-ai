// OpenAI Provider (兼容协议，也作 fallback 基类)
import { BaseProvider } from './base';
import type { ChatRequest, ChatResponse, StreamChunk } from '../types';
import { AiGatewayError } from '../types';
import { Provider } from '@matrixflow/shared';

export class OpenAIProvider extends BaseProvider {
  name = Provider.OPENAI;
  protected baseUrl: string;
  protected apiKey: string;
  private defaultModel: string;

  constructor(opts: { apiKey: string; baseUrl?: string; defaultModel?: string }) {
    super();
    this.apiKey = opts.apiKey;
    this.baseUrl = (opts.baseUrl ?? 'https://api.openai.com/v1').replace(/\/$/, '');
    this.defaultModel = opts.defaultModel ?? 'gpt-4o-mini';
  }

  async chat(req: ChatRequest): Promise<ChatResponse> {
    return this.withRetry(async () => {
      const res = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST', headers: this.headers(),
        body: JSON.stringify(this.toPayload(req, false)),
      });
      if (!res.ok) throw await this.toError(res);
      const j = await res.json() as any;
      const u = j.usage ?? {};
      return {
        id: j.id, model: req.model, content: j.choices?.[0]?.message?.content ?? '',
        usage: { inputTokens: u.prompt_tokens ?? 0, outputTokens: u.completion_tokens ?? 0, totalTokens: u.total_tokens ?? 0 },
        costUsd: 0, provider: this.name,
      };
    });
  }

  async *chatStream(req: ChatRequest): AsyncIterable<StreamChunk> {
    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST', headers: this.headers(), body: JSON.stringify(this.toPayload(req, true)),
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
        const d = t.slice(5).trim();
        if (d === '[DONE]') { yield { delta: '', done: true }; return; }
        try { const j = JSON.parse(d); const delta = j.choices?.[0]?.delta?.content ?? ''; if (delta) yield { delta, done: false }; } catch {}
      }
    }
    yield { delta: '', done: true };
  }

  async embedding(text: string, model = 'text-embedding-3-small') {
    const res = await fetch(`${this.baseUrl}/embeddings`, {
      method: 'POST', headers: this.headers(),
      body: JSON.stringify({ model, input: text, encoding_format: 'float' }),
    });
    if (!res.ok) throw await this.toError(res);
    const j = await res.json() as any;
    return { vector: j.data[0].embedding, tokens: j.usage?.total_tokens ?? Math.ceil(text.length / 4) };
  }

  private toPayload(req: ChatRequest, stream: boolean) {
    return { model: req.model || this.defaultModel, messages: req.messages, temperature: req.temperature ?? 0.7, max_tokens: req.maxTokens ?? 2000, stream, response_format: req.responseFormat === 'json_object' ? { type: 'json_object' } : undefined };
  }
  private async toError(res: Response): Promise<AiGatewayError> {
    let msg = `OpenAI ${res.status}`;
    try { const j = await res.json(); msg = j.error?.message ?? JSON.stringify(j); } catch {}
    return new AiGatewayError('AI_PROVIDER_ERROR', msg, res.status);
  }
}
