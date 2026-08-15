import { z } from 'zod';
import { HttpError } from './runtime.js';

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
  agentRun: z.object({ input: jsonRecord.default({}) }).strict(),
  contentProject: z.object({ name: trimmed(180), productData: jsonRecord.default({}) }).strict(),
  contentGenerate: z
    .object({
      type: z.string().trim().min(1).max(64).optional(),
      language: z.string().trim().max(20).optional(),
      variables: jsonRecord.optional(),
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
  workflowRun: z.object({ input: jsonRecord.default({}) }).strict(),
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
