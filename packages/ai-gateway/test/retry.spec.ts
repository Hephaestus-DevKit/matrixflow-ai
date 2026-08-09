import { describe, expect, it, jest } from '@jest/globals';
import { Provider } from '@matrixflow/shared';
import { BaseProvider } from '../src/providers/base';
import {
  AiGatewayError,
  type ChatRequest,
  type ChatResponse,
  type StreamChunk,
} from '../src/types';

class TestProvider extends BaseProvider {
  name = Provider.GLM;
  protected baseUrl = 'https://example.com';
  protected apiKey = 'test';

  retry<T>(operation: () => Promise<T>) {
    return this.withRetry(operation, 3, 0);
  }

  chat(_request: ChatRequest): Promise<ChatResponse> {
    throw new Error('not used');
  }

  async *chatStream(_request: ChatRequest): AsyncIterable<StreamChunk> {
    throw new Error('not used');
  }

  embedding(_text: string): Promise<{ vector: number[]; tokens: number }> {
    throw new Error('not used');
  }
}

describe('BaseProvider retry policy', () => {
  const provider = new TestProvider();

  it('does not retry permanent 4xx responses', async () => {
    const operation = jest
      .fn<() => Promise<string>>()
      .mockRejectedValue(new AiGatewayError('AI_PROVIDER_ERROR', 'invalid request', 400));

    await expect(provider.retry(operation)).rejects.toMatchObject({ status: 400 });
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('retries transient provider failures', async () => {
    const operation = jest
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new AiGatewayError('AI_PROVIDER_ERROR', 'busy', 503))
      .mockResolvedValue('ok');

    await expect(provider.retry(operation)).resolves.toBe('ok');
    expect(operation).toHaveBeenCalledTimes(2);
  });
});
