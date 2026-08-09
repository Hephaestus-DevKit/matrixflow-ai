// AI Gateway · 类型与接口
import type { Provider } from '@matrixflow/shared';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  toolCallId?: string;
  toolCalls?: unknown[];
}

export interface ChatRequest {
  model: string;
  providerModels?: Partial<Record<Provider, string>>;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  responseFormat?: 'text' | 'json_object';
  tools?: unknown[];
  signal?: AbortSignal;
  // 元数据用于计量
  metadata?: {
    organizationId: string;
    agentId?: string;
    promptKey?: string;
    requestId?: string;
  };
}

export interface ChatResponse {
  id: string;
  model: string;
  content: string;
  toolCalls?: unknown[];
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  costUsd: number;
  cached?: boolean;
  provider: Provider;
}

export interface StreamChunk {
  delta: string;
  done: boolean;
  usage?: ChatResponse['usage'];
  provider?: Provider;
  model?: string;
}

export interface ProviderClient {
  name: Provider;
  chat(req: ChatRequest): Promise<ChatResponse>;
  chatStream(req: ChatRequest): AsyncIterable<StreamChunk>;
  embedding(text: string, model?: string): Promise<{ vector: number[]; tokens: number }>;
}

export function requestSignal(timeoutMs: number, signal?: AbortSignal): AbortSignal {
  const timeout = AbortSignal.timeout(timeoutMs);
  return signal ? AbortSignal.any([signal, timeout]) : timeout;
}

export class AiGatewayError extends Error {
  constructor(
    public code: string,
    message: string,
    public status?: number,
  ) {
    super(message);
    this.name = 'AiGatewayError';
  }
}

export function isAbortError(error: unknown): boolean {
  return (
    (error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError')) ||
    (error instanceof AiGatewayError && error.code === 'AI_ABORTED')
  );
}

export function isRetryableProviderError(error: unknown): boolean {
  if (isAbortError(error)) return false;
  if (!(error instanceof AiGatewayError) || error.status === undefined) return true;
  return (
    error.status === 408 ||
    error.status === 409 ||
    error.status === 425 ||
    error.status === 429 ||
    error.status >= 500
  );
}
