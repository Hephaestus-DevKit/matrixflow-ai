import { GlmProvider } from './glm';
import { OpenAIProvider } from './openai';
import type { ProviderClient } from '../types';
import { Provider } from '@matrixflow/shared';

export { GlmProvider, OpenAIProvider };

export function createProviders(opts: {
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
}): Record<Provider, ProviderClient | null> {
  return {
    [Provider.GLM]: opts.glm?.apiKey ? new GlmProvider(opts.glm) : null,
    [Provider.OPENAI]: opts.openai?.apiKey ? new OpenAIProvider(opts.openai) : null,
  };
}
