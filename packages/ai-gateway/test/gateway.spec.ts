import { describe, it, expect } from '@jest/globals';
import { AiGateway, AiGatewayError } from '../src/index';
import { Provider } from '@matrixflow/shared';

describe('AiGateway', () => {
  it('throws when no providers configured', () => {
    expect(() => new AiGateway({})).toThrow('No AI provider configured');
  });

  it('creates with GLM only', () => {
    const gw = new AiGateway({ glm: { apiKey: 'test-key' } });
    expect(gw).toBeDefined();
  });

  it('creates with fallback chain', () => {
    const gw = new AiGateway({ glm: { apiKey: 'test-key' }, openai: { apiKey: 'test-key-2' } });
    expect(gw).toBeDefined();
  });

  it('maps the model independently for a fallback provider', async () => {
    const gateway = new AiGateway({
      glm: { apiKey: 'glm', defaultModel: 'glm-default' },
      openai: { apiKey: 'openai', defaultModel: 'openai-default' },
    });
    const glm = { chat: jest.fn().mockRejectedValue(new Error('down')) };
    const openai = {
      chat: jest.fn(async (request) => ({
        id: '1',
        model: request.model,
        content: 'ok',
        costUsd: 0,
        provider: Provider.OPENAI,
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
      })),
    };
    Object.assign((gateway as any).providers, { [Provider.GLM]: glm, [Provider.OPENAI]: openai });

    const result = await gateway.chat({
      model: 'default',
      providerModels: { [Provider.GLM]: 'glm-4-plus', [Provider.OPENAI]: 'gpt-4o-mini' },
      messages: [{ role: 'user', content: 'hello' }],
    });

    expect(result.model).toBe('gpt-4o-mini');
    expect(openai.chat).toHaveBeenCalledWith(expect.objectContaining({ model: 'gpt-4o-mini' }));
  });

  it('does not fall back after a stream has emitted content', async () => {
    const gateway = new AiGateway({
      glm: { apiKey: 'glm' },
      openai: { apiKey: 'openai' },
    });
    const glm = {
      async *chatStream() {
        yield { delta: 'partial', done: false };
        throw new Error('stream interrupted');
      },
    };
    const openai = { chat: jest.fn() };
    Object.assign((gateway as any).providers, { [Provider.GLM]: glm, [Provider.OPENAI]: openai });

    const consume = async () => {
      const chunks = [];
      for await (const chunk of gateway.chatStream({
        model: 'default',
        messages: [{ role: 'user', content: 'hello' }],
      })) {
        chunks.push(chunk);
      }
      return chunks;
    };

    await expect(consume()).rejects.toThrow('stream interrupted');
    expect(openai.chat).not.toHaveBeenCalled();
  });

  it('does not fall back when the caller aborts', async () => {
    const gateway = new AiGateway({
      glm: { apiKey: 'glm' },
      openai: { apiKey: 'openai' },
    });
    const controller = new AbortController();
    const aborted = Object.assign(new Error('aborted'), { name: 'AbortError' });
    const glm = {
      chat: jest.fn(async () => {
        controller.abort();
        throw aborted;
      }),
    };
    const openai = { chat: jest.fn() };
    Object.assign((gateway as any).providers, { [Provider.GLM]: glm, [Provider.OPENAI]: openai });

    await expect(
      gateway.chat({
        model: 'default',
        messages: [{ role: 'user', content: 'hello' }],
        signal: controller.signal,
      }),
    ).rejects.toBe(aborted);
    expect(openai.chat).not.toHaveBeenCalled();
  });

  it('classifies non-retryable provider errors', async () => {
    const { isRetryableProviderError } = await import('../src/types');
    expect(
      isRetryableProviderError(new AiGatewayError('AI_PROVIDER_ERROR', 'bad input', 400)),
    ).toBe(false);
    expect(isRetryableProviderError(new AiGatewayError('AI_PROVIDER_ERROR', 'busy', 429))).toBe(
      true,
    );
    expect(isRetryableProviderError(new AiGatewayError('AI_PROVIDER_ERROR', 'down', 503))).toBe(
      true,
    );
  });
});

describe('Prompt rendering', () => {
  it('renders variables', async () => {
    const { compilePrompt } = await import('../src/prompt/index');
    const r = compilePrompt(
      { systemPrompt: 'You are {{role}}.', userPromptTemplate: 'Product: {{name|json}}' },
      { role: 'assistant', name: 'Widget' },
    );
    expect(r.systemPrompt).toBe('You are assistant.');
    expect(r.userPrompt).toContain('Widget');
  });
});
