import { z } from 'zod';

export const WORKFLOW_NODE_TYPES = [
  'trigger',
  'ai',
  'condition',
  'transform',
  'webhook',
  'email',
] as const;

export const workflowNodeSchema = z
  .object({
    id: z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/),
    type: z.enum(WORKFLOW_NODE_TYPES),
    config: z.record(z.unknown()).optional(),
    position: z.object({ x: z.number().finite(), y: z.number().finite() }).strict().optional(),
  })
  .strict();

export const workflowEdgeSchema = z
  .object({
    source: z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/),
    target: z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/),
    condition: z.enum(['always', 'true', 'false', 'truthy', 'falsy']).optional(),
  })
  .strict();

export const workflowDslSchema = z
  .object({
    nodes: z.array(workflowNodeSchema).min(1).max(100),
    edges: z.array(workflowEdgeSchema).max(300),
  })
  .strict()
  .superRefine((value, context) => {
    if (JSON.stringify(value).length > 1_000_000) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'Workflow DSL exceeds 1 MB' });
    }
  });

export type WorkflowNode = z.infer<typeof workflowNodeSchema>;
export type WorkflowEdge = z.infer<typeof workflowEdgeSchema>;
export type WorkflowDSL = z.infer<typeof workflowDslSchema>;

export interface ExecutionContext {
  organizationId: string;
  userId: string;
  workflowId: string;
  runId: string;
}
