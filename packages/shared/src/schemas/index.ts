// @matrixflow/shared · Zod schemas (前后端共享校验)
import { z } from 'zod';

export const emailSchema = z.string().email().max(255).toLowerCase();
export const passwordSchema = z.string().min(8).max(128);
export const nameSchema = z.string().min(1).max(100);
export const slugSchema = z.string().regex(/^[a-z0-9-]{3,40}$/);

export const loginSchema = z.object({ email: emailSchema, password: z.string().min(1) });
export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: nameSchema,
  organizationName: nameSchema.optional(),
});

export const createOrgSchema = z.object({ name: nameSchema, slug: slugSchema });
export const inviteMemberSchema = z.object({ email: emailSchema, roleName: z.string() });

export const createAgentSchema = z.object({
  name: nameSchema,
  role: z.string().min(1),
  description: z.string().max(2000).optional(),
  systemPrompt: z.record(z.any()),
  model: z.string().default('glm-4-plus'),
  temperature: z.number().min(0).max(2).default(0.7),
  maxTokens: z.number().int().min(1).max(32000).default(2000),
  memoryMode: z.enum(['short', 'long', 'none']).default('short'),
  skills: z.array(z.object({ skillKey: z.string(), config: z.any().optional() })).default([]),
  tools: z.array(z.object({ toolKey: z.string(), config: z.any().optional() })).default([]),
});

export const runAgentSchema = z.object({
  input: z.record(z.any()),
  stream: z.boolean().default(false),
});

// 内容工厂：商品资料
export const productDataSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  features: z.array(z.string()).default([]),
  specs: z.record(z.any()).default({}),
  images: z.array(z.string().url()).default([]),
  price: z.number().nonnegative().optional(),
  currency: z.string().length(3).default('USD'),
  category: z.string().optional(),
  brand: z.string().optional(),
});
