import { describe, it, expect } from '@jest/globals';
import { AiGateway } from '../src/index';

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
});

describe('Prompt rendering', () => {
  it('renders variables', async () => {
    const { compilePrompt } = await import('../src/prompt/index');
    const r = compilePrompt({ systemPrompt: 'You are {{role}}.', userPromptTemplate: 'Product: {{name|json}}' }, { role: 'assistant', name: 'Widget' });
    expect(r.systemPrompt).toBe('You are assistant.');
    expect(r.userPrompt).toContain('Widget');
  });
});
