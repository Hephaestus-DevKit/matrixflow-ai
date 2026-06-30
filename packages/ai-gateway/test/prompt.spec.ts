import { describe, it, expect } from '@jest/globals';
import { renderTemplate, compilePrompt } from '../src/prompt/index';

describe('Prompt rendering', () => {
  it('renders simple variables', () => {
    expect(renderTemplate('Hello {{name}}!', { name: 'World' })).toBe('Hello World!');
  });

  it('renders json filter', () => {
    const result = renderTemplate('Data: {{data|json}}', { data: { a: 1 } });
    expect(result).toContain('"a"');
  });

  it('handles missing variables gracefully', () => {
    expect(renderTemplate('Hello {{name}}!', {})).toBe('Hello !');
  });

  it('compiles a full prompt', () => {
    const result = compilePrompt(
      { systemPrompt: 'You are {{role}}.', userPromptTemplate: 'Product: {{product}}' },
      { role: 'copywriter', product: 'Widget' },
    );
    expect(result.systemPrompt).toBe('You are copywriter.');
    expect(result.userPrompt).toBe('Product: Widget');
  });
});
