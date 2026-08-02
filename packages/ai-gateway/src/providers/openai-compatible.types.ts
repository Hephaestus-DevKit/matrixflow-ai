export interface ProviderUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
}

export interface ChatCompletionPayload {
  id?: string;
  usage?: ProviderUsage;
  choices?: Array<{
    message?: { content?: string };
    delta?: { content?: string };
  }>;
}

export interface EmbeddingPayload {
  data?: Array<{ embedding?: number[] }>;
  usage?: ProviderUsage;
}

export function providerErrorMessage(payload: unknown): string | undefined {
  if (!payload || typeof payload !== 'object') return undefined;
  const error = (payload as { error?: unknown }).error;
  if (!error || typeof error !== 'object') return undefined;
  const message = (error as { message?: unknown }).message;
  return typeof message === 'string' ? message : undefined;
}
