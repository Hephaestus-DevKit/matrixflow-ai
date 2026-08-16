import { z } from 'zod';
import { HttpError } from './runtime.js';
import { BILLING_EVENT_TYPES, SUBSCRIPTION_STATUSES } from './billing.js';

const trimmed = (max) => z.string().trim().min(1).max(max);
const jsonRecord = z.record(z.unknown());

export const schemas = {
  agentCreate: z
    .object({
      name: trimmed(100),
      role: trimmed(100),
      systemPrompt: jsonRecord.default({}),
      skills: z
        .array(z.union([z.string(), jsonRecord]))
        .max(50)
        .default([]),
      tools: z
        .array(z.union([z.string(), jsonRecord]))
        .max(50)
        .default([]),
      model: z.string().trim().max(100).optional(),
      temperature: z.number().min(0).max(2).optional(),
      maxTokens: z.number().int().min(1).max(32_000).optional(),
      topP: z.number().min(0).max(1).optional(),
    })
    .strict(),
  agentUpdate: z
    .object({
      name: trimmed(100).optional(),
      role: trimmed(100).optional(),
      systemPrompt: jsonRecord.optional(),
      skills: z
        .array(z.union([z.string(), jsonRecord]))
        .max(50)
        .optional(),
      tools: z
        .array(z.union([z.string(), jsonRecord]))
        .max(50)
        .optional(),
      model: z.string().trim().max(100).optional(),
      temperature: z.number().min(0).max(2).optional(),
      maxTokens: z.number().int().min(1).max(32_000).optional(),
      topP: z.number().min(0).max(1).optional(),
      status: z.enum(['DRAFT', 'ACTIVE', 'PAUSED']).optional(),
    })
    .strict(),
  agentRun: z
    .object({
      input: jsonRecord.default({}),
      retryOf: z.string().trim().max(36).optional(),
      retryCount: z.number().int().min(0).max(10).optional(),
      mode: z.enum(['sync', 'async']).default('sync'),
    })
    .strict(),
  contentProject: z.object({ name: trimmed(180), productData: jsonRecord.default({}) }).strict(),
  contentGenerate: z
    .object({
      type: z.string().trim().min(1).max(64).optional(),
      language: z.string().trim().max(20).optional(),
      variables: jsonRecord.optional(),
      mode: z.enum(['sync', 'async']).default('sync'),
    })
    .strict(),
  knowledgeBase: z
    .object({ name: trimmed(180), description: z.string().trim().max(5_000).default('') })
    .strict(),
  knowledgeDocument: z
    .object({
      knowledgeBaseId: trimmed(36),
      title: trimmed(255),
      fileId: trimmed(36),
      mimeType: trimmed(128),
      size: z
        .number()
        .int()
        .min(1)
        .max(20 * 1024 * 1024),
    })
    .strict(),
  knowledgeIndex: z
    .object({
      documentId: trimmed(36),
      mode: z.enum(['sync', 'async']).default('sync'),
    })
    .strict(),
  knowledgeAsk: z.object({ question: trimmed(4_000) }).strict(),
  workflowCreate: z
    .object({
      name: trimmed(180),
      description: z.string().trim().max(5_000).default(''),
      dsl: jsonRecord.default({ nodes: [], edges: [] }),
    })
    .strict(),
  workflowVersion: z
    .object({ dsl: jsonRecord, changeNote: z.string().trim().max(500).optional() })
    .strict(),
  workflowRun: z
    .object({
      input: jsonRecord.default({}),
      retryOf: z.string().trim().max(36).optional(),
      retryCount: z.number().int().min(0).max(10).optional(),
      mode: z.enum(['sync', 'async']).default('sync'),
    })
    .strict(),
  message: z
    .object({
      role: z.enum(['user', 'assistant', 'system', 'customer', 'agent']),
      content: trimmed(16_000),
    })
    .strict(),
  customer: z
    .object({
      name: z.string().trim().max(180).optional(),
      email: z.string().trim().email().max(320).optional(),
      phone: z.string().trim().max(40).optional(),
      source: z.string().trim().max(80).default('manual'),
    })
    .strict()
    .refine((value) => value.name || value.email || value.phone, '请至少填写姓名、邮箱或电话'),
  billingRequest: z
    .object({
      requestedPlan: z.enum(['pro', 'team']),
      requestedSeats: z.number().int().min(1).max(500).default(1),
      note: z.string().trim().max(1_000).default(''),
    })
    .strict(),
  billingCheckout: z
    .object({
      planId: z.enum(['pro', 'team']),
      seats: z.number().int().min(1).max(500).default(1),
      successUrl: z.string().url().max(2_000).optional(),
      cancelUrl: z.string().url().max(2_000).optional(),
    })
    .strict(),
  billingWebhook: z
    .object({
      eventId: trimmed(180),
      organizationId: trimmed(36),
      provider: z.enum(['stripe', 'lemonsqueezy', 'manual', 'other']),
      type: z.enum(BILLING_EVENT_TYPES),
      subscriptionId: trimmed(180),
      planId: z.enum(['free', 'pro', 'team']),
      status: z.enum(SUBSCRIPTION_STATUSES),
      seats: z.number().int().min(1).max(500).default(1),
      currentPeriodStart: z.string().datetime().optional(),
      currentPeriodEnd: z.string().datetime().optional(),
      metadata: jsonRecord.default({}),
      invoice: z
        .object({
          invoiceId: trimmed(180),
          status: z.enum(['draft', 'open', 'paid', 'void', 'uncollectible']),
          amountCents: z.number().int().min(0).max(100_000_000),
          currency: z
            .string()
            .trim()
            .regex(/^[A-Za-z]{3}$/)
            .default('USD'),
          hostedUrl: z.string().url().max(2_000).optional(),
          issuedAt: z.string().datetime().optional(),
          dueAt: z.string().datetime().optional(),
          paidAt: z.string().datetime().optional(),
        })
        .strict()
        .optional(),
      transaction: z
        .object({
          transactionId: trimmed(180),
          type: z.enum(['payment', 'refund', 'chargeback']),
          status: z.enum(['pending', 'succeeded', 'failed']),
          amountCents: z.number().int().min(0).max(100_000_000),
          currency: z
            .string()
            .trim()
            .regex(/^[A-Za-z]{3}$/)
            .default('USD'),
          processedAt: z.string().datetime().optional(),
        })
        .strict()
        .optional(),
    })
    .strict(),
  accountDelete: z
    .object({
      confirmation: z.string().trim().max(180),
      reason: z.string().trim().max(500).default(''),
    })
    .strict(),
  jobCancel: z.object({ reason: z.string().trim().max(500).default('') }).strict(),
  apiKeyCreate: z
    .object({
      name: trimmed(100),
      scopes: z.array(z.string().trim().max(64)).min(1).max(20),
      expiresAt: z.string().datetime().optional(),
    })
    .strict(),
};

export function parse(schema, value) {
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  throw new HttpError('提交的数据不符合要求', 400, 'VALIDATION_ERROR', {
    issues: result.error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    })),
  });
}
