import { describe, it, expect } from '@jest/globals';
import {
  createAgentSchema,
  createCustomerSchema,
  createLeadSchema,
  loginSchema,
  productDataSchema,
  publishMarketplaceItemSchema,
  refreshTokenSchema,
  registerSchema,
  rejectMarketplaceItemSchema,
  executeWorkflowJobSchema,
  updateProfileSchema,
  workflowDslSchema,
} from '../src';

describe('Auth schemas', () => {
  it('validates login', () => {
    expect(() =>
      loginSchema.parse({ email: 'test@example.com', password: '12345678' }),
    ).not.toThrow();
    expect(() => loginSchema.parse({ email: 'invalid', password: '' })).toThrow();
  });
  it('validates register', () => {
    expect(() =>
      registerSchema.parse({ email: 'a@b.com', password: '12345678', name: 'Test' }),
    ).not.toThrow();
    expect(() => registerSchema.parse({ email: 'a', password: '1', name: '' })).toThrow();
  });

  it('rejects unknown auth and profile fields', () => {
    expect(() =>
      refreshTokenSchema.parse({ refreshToken: 'x'.repeat(48), role: 'owner' }),
    ).toThrow();
    expect(() =>
      updateProfileSchema.parse({ name: 'User', organizationId: 'other-org' }),
    ).toThrow();
    expect(updateProfileSchema.parse({ name: ' User ' })).toEqual({ name: 'User' });
  });
});

describe('Tenant-facing write schemas', () => {
  it('rejects mass-assignment fields on customers', () => {
    expect(() =>
      createCustomerSchema.parse({ name: 'Customer', organizationId: 'other-org' }),
    ).toThrow();
  });

  it('validates privileged moderation and internal job payloads strictly', () => {
    expect(rejectMarketplaceItemSchema.parse({ reason: ' policy violation ' })).toEqual({
      reason: 'policy violation',
    });
    expect(() => rejectMarketplaceItemSchema.parse({ reason: '', status: 'approved' })).toThrow();
    expect(() => executeWorkflowJobSchema.parse({ userId: 'not-a-uuid' })).toThrow();
  });

  it('bounds lead scores and requires UUID customer IDs', () => {
    expect(() => createLeadSchema.parse({ customerId: 'not-a-uuid', score: 101 })).toThrow();
  });

  it('rejects negative marketplace prices and oversized payloads', () => {
    expect(() =>
      publishMarketplaceItemSchema.parse({
        type: 'prompt',
        name: 'Prompt',
        priceUsd: -1,
        payload: {},
      }),
    ).toThrow();
    expect(() =>
      publishMarketplaceItemSchema.parse({
        type: 'prompt',
        name: 'Prompt',
        payload: { value: 'x'.repeat(260_000) },
      }),
    ).toThrow();
  });
});

describe('Agent schema', () => {
  it('validates create agent', () => {
    expect(() =>
      createAgentSchema.parse({
        name: 'My Agent',
        role: 'copywriter',
        systemPrompt: { templateKey: 'product_title' },
      }),
    ).not.toThrow();
  });
});

describe('Product data schema', () => {
  it('validates product', () => {
    expect(() => productDataSchema.parse({ title: 'Test Product' })).not.toThrow();
    expect(() => productDataSchema.parse({})).toThrow();
  });
});

describe('Workflow DSL schema', () => {
  it('accepts a bounded typed workflow', () => {
    expect(() =>
      workflowDslSchema.parse({
        nodes: [
          { id: 'trigger', type: 'trigger' },
          { id: 'condition', type: 'condition', config: { field: 'score', operator: 'gte' } },
        ],
        edges: [{ source: 'trigger', target: 'condition', condition: 'truthy' }],
      }),
    ).not.toThrow();
  });

  it('rejects unknown node types and unbounded workflow payloads', () => {
    expect(() =>
      workflowDslSchema.parse({ nodes: [{ id: 'node', type: 'shell' }], edges: [] }),
    ).toThrow();
    expect(() =>
      workflowDslSchema.parse({
        nodes: [{ id: 'node', type: 'trigger', config: { value: 'x'.repeat(1_000_000) } }],
        edges: [],
      }),
    ).toThrow('Workflow DSL exceeds 1 MB');
  });
});
