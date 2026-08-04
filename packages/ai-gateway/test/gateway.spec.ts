import { describe, it, expect } from '@jest/globals';
import { AiGateway } from '../src/index';
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
