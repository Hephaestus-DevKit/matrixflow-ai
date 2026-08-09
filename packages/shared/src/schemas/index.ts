// @matrixflow/shared · Zod schemas (前后端共享校验)
import { z } from 'zod';
import { workflowDslSchema } from '../workflow';

export const emailSchema = z.string().email().max(255).toLowerCase();
export const passwordSchema = z.string().min(8).max(128);
export const nameSchema = z.string().min(1).max(100);
export const slugSchema = z.string().regex(/^[a-z0-9-]{3,40}$/);
export const uuidSchema = z.string().uuid();

export const loginSchema = z.object({ email: emailSchema, password: z.string().min(1) });
export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: nameSchema,
  organizationName: nameSchema.optional(),
});

export const refreshTokenSchema = z
  .object({ refreshToken: z.string().min(20).max(512).optional() })
  .strict();

export const updateProfileSchema = z
  .object({
    name: nameSchema.transform((value) => value.trim()).optional(),
    avatarUrl: z.string().max(2_048).optional(),
  })
  .strict()
  .refine((value) => value.name !== undefined || value.avatarUrl !== undefined, {
    message: 'At least one profile field is required',
  });

export const createOrgSchema = z.object({ name: nameSchema, slug: slugSchema });
export const inviteMemberSchema = z.object({ email: emailSchema, roleName: z.string() });

export const createAgentSchema = z.object({
  name: nameSchema,
  role: z.string().min(1),
  description: z.string().max(2000).optional(),
  systemPrompt: z.record(z.unknown()),
  model: z.string().default('glm-4-plus'),
  temperature: z.number().min(0).max(2).default(0.7),
  maxTokens: z.number().int().min(1).max(32000).default(2000),
  memoryMode: z.enum(['short', 'long', 'none']).default('short'),
  skills: z.array(z.object({ skillKey: z.string(), config: z.unknown().optional() })).default([]),
  tools: z.array(z.object({ toolKey: z.string(), config: z.unknown().optional() })).default([]),
});

export const runAgentSchema = z.object({
  input: z.record(z.unknown()),
  stream: z.boolean().default(false),
});

// 内容工厂：商品资料
export const productDataSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  features: z.array(z.string()).default([]),
  specs: z.record(z.unknown()).default({}),
  images: z.array(z.string().url()).default([]),
  price: z.number().nonnegative().optional(),
  currency: z.string().length(3).default('USD'),
  category: z.string().optional(),
  brand: z.string().optional(),
});

export const createContentProjectSchema = z
  .object({
    name: nameSchema.transform((value) => value.trim()),
    productData: productDataSchema,
    brandVoiceId: uuidSchema.optional(),
  })
  .strict();

export const createCustomerSchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    email: emailSchema.optional(),
    phone: z.string().trim().min(1).max(40).optional(),
    avatarUrl: z.string().url().max(2_048).optional(),
    stage: z.enum(['lead', 'contacted', 'qualified', 'proposal', 'won', 'lost']).default('lead'),
    source: z.string().trim().max(100).optional(),
    externalId: z.string().trim().max(255).optional(),
    metadata: z.record(z.unknown()).optional(),
  })
  .strict()
  .refine((value) => value.name || value.email || value.phone, {
    message: 'At least one of name, email, or phone is required',
  });

export const createLeadSchema = z
  .object({
    customerId: uuidSchema,
    source: z.string().trim().max(100).optional(),
    score: z.number().int().min(0).max(100).default(0),
  })
  .strict();

export const sendCrmMessageSchema = z
  .object({
    content: z.string().trim().min(1).max(20_000),
  })
  .strict();

export const marketListSchema = z
  .object({
    type: z.enum(['agent', 'workflow', 'prompt', 'content', 'solution']).optional(),
    category: z.string().trim().max(100).optional(),
    q: z.string().trim().max(200).optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();

export const publishMarketplaceItemSchema = z
  .object({
    type: z.enum(['agent', 'workflow', 'prompt', 'content', 'solution']),
    name: nameSchema.transform((value) => value.trim()),
    description: z.string().trim().max(2_000).optional(),
    category: z.string().trim().max(100).optional(),
    priceUsd: z.number().finite().nonnegative().max(1_000_000).default(0),
    payload: z.unknown(),
  })
  .strict()
  .superRefine((value, ctx) => {
    let serialized = '';
    try {
      serialized = JSON.stringify(value.payload);
    } catch {
      /* reported below */
    }
    if (!serialized || serialized.length > 250_000) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['payload'],
        message: 'Payload must be valid JSON no larger than 250 KB',
      });
    }
  });

export const marketplaceReviewSchema = z
  .object({
    rating: z.number().int().min(1).max(5),
    comment: z.string().trim().max(2_000).optional(),
  })
  .strict();

export const rejectMarketplaceItemSchema = z
  .object({ reason: z.string().trim().min(1).max(2_000) })
  .strict();

export const executeWorkflowJobSchema = z.object({ userId: uuidSchema }).strict();

export const aiPromptRequestSchema = z
  .object({
    promptKey: z.string().trim().min(1).max(100),
    variables: z.record(z.unknown()),
    agentId: uuidSchema.optional(),
    responseFormat: z.enum(['text', 'json_object']).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    const size = JSON.stringify(value.variables).length;
    if (size > 100_000)
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['variables'],
        message: 'Variables exceed 100 KB',
      });
  });

export const createKnowledgeBaseSchema = z
  .object({
    name: nameSchema.transform((value) => value.trim()),
    description: z.string().trim().max(2_000).optional(),
  })
  .strict();

export const ragQuerySchema = z.object({ question: z.string().trim().min(1).max(4_000) }).strict();

const jsonPayloadSchema = z.unknown().superRefine((value, ctx) => {
  try {
    if (JSON.stringify(value).length > 1_000_000) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'JSON payload exceeds 1 MB' });
    }
  } catch {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Payload must be valid JSON' });
  }
});

export const createWorkflowSchema = z
  .object({
    name: nameSchema.transform((value) => value.trim()),
    description: z.string().trim().max(2_000).optional(),
    dsl: workflowDslSchema,
  })
  .strict();

export const saveWorkflowVersionSchema = z
  .object({
    dsl: workflowDslSchema,
    changeNote: z.string().trim().max(500).optional(),
  })
  .strict();

export const runWorkflowSchema = z.object({ input: jsonPayloadSchema.optional() }).strict();

export const generateContentSchema = z
  .object({
    type: z.string().regex(/^[a-z_]{1,50}$/),
    variables: z.record(z.unknown()).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (JSON.stringify(value.variables ?? {}).length > 100_000) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['variables'],
        message: 'Variables exceed 100 KB',
      });
    }
  });

export const generateAllContentSchema = z
  .object({
    language: z
      .string()
      .trim()
      .regex(/^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})?$/)
      .default('en'),
  })
  .strict();

export const saveContentVersionSchema = z
  .object({
    content: z.string().max(1_000_000),
    changeNote: z.string().trim().max(500).optional(),
  })
  .strict();

export const scoreContentSchema = z
  .object({
    dimension: z
      .string()
      .trim()
      .regex(/^[a-z_]{1,50}$/),
  })
  .strict();

export const subscribeSchema = z
  .object({ planId: uuidSchema, interval: z.enum(['month', 'year']).default('month') })
  .strict();

export const cloneAgentSchema = z.object({ name: nameSchema.optional() }).strict();

export const changeRoleSchema = z
  .object({ roleName: z.enum(['owner', 'admin', 'member']) })
  .strict();
