import { describe, it, expect } from '@jest/globals';
import { registerSchema, loginSchema, createAgentSchema, productDataSchema } from '../schemas';

describe('Auth schemas', () => {
  it('validates login', () => {
    expect(() => loginSchema.parse({ email: 'test@example.com', password: '12345678' })).not.toThrow();
    expect(() => loginSchema.parse({ email: 'invalid', password: '' })).toThrow();
  });
  it('validates register', () => {
    expect(() => registerSchema.parse({ email: 'a@b.com', password: '12345678', name: 'Test' })).not.toThrow();
    expect(() => registerSchema.parse({ email: 'a', password: '1', name: '' })).toThrow();
  });
});

describe('Agent schema', () => {
  it('validates create agent', () => {
    expect(() => createAgentSchema.parse({
      name: 'My Agent', role: 'copywriter',
      systemPrompt: { templateKey: 'product_title' },
    })).not.toThrow();
  });
});

describe('Product data schema', () => {
  it('validates product', () => {
    expect(() => productDataSchema.parse({ title: 'Test Product' })).not.toThrow();
    expect(() => productDataSchema.parse({})).toThrow();
  });
});
