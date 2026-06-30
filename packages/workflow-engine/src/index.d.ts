import { z } from 'zod';
export declare const NODE_TYPES: readonly ["trigger", "ai", "condition", "transform", "webhook", "email", "content", "human", "schedule", "loop"];
export type NodeType = (typeof NODE_TYPES)[number];
export declare const nodeSchema: z.ZodObject<{
    id: z.ZodString;
    type: z.ZodEnum<["trigger", "ai", "condition", "transform", "webhook", "email", "content", "human", "schedule", "loop"]>;
    label: z.ZodOptional<z.ZodString>;
    config: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodAny>>;
    position: z.ZodObject<{
        x: z.ZodNumber;
        y: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        x: number;
        y: number;
    }, {
        x: number;
        y: number;
    }>;
}, "strip", z.ZodTypeAny, {
    type: "webhook" | "email" | "content" | "ai" | "trigger" | "condition" | "transform" | "human" | "schedule" | "loop";
    config: Record<string, any>;
    id: string;
    position: {
        x: number;
        y: number;
    };
    label?: string | undefined;
}, {
    type: "webhook" | "email" | "content" | "ai" | "trigger" | "condition" | "transform" | "human" | "schedule" | "loop";
    id: string;
    position: {
        x: number;
        y: number;
    };
    config?: Record<string, any> | undefined;
    label?: string | undefined;
}>;
export type WorkflowNode = z.infer<typeof nodeSchema>;
export declare const edgeSchema: z.ZodObject<{
    id: z.ZodString;
    source: z.ZodString;
    target: z.ZodString;
    condition: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    id: string;
    source: string;
    target: string;
    condition?: string | undefined;
}, {
    id: string;
    source: string;
    target: string;
    condition?: string | undefined;
}>;
export type WorkflowEdge = z.infer<typeof edgeSchema>;
export declare const workflowDslSchema: z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    name: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    nodes: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        type: z.ZodEnum<["trigger", "ai", "condition", "transform", "webhook", "email", "content", "human", "schedule", "loop"]>;
        label: z.ZodOptional<z.ZodString>;
        config: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodAny>>;
        position: z.ZodObject<{
            x: z.ZodNumber;
            y: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            x: number;
            y: number;
        }, {
            x: number;
            y: number;
        }>;
    }, "strip", z.ZodTypeAny, {
        type: "webhook" | "email" | "content" | "ai" | "trigger" | "condition" | "transform" | "human" | "schedule" | "loop";
        config: Record<string, any>;
        id: string;
        position: {
            x: number;
            y: number;
        };
        label?: string | undefined;
    }, {
        type: "webhook" | "email" | "content" | "ai" | "trigger" | "condition" | "transform" | "human" | "schedule" | "loop";
        id: string;
        position: {
            x: number;
            y: number;
        };
        config?: Record<string, any> | undefined;
        label?: string | undefined;
    }>, "many">;
    edges: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        source: z.ZodString;
        target: z.ZodString;
        condition: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        source: string;
        target: string;
        condition?: string | undefined;
    }, {
        id: string;
        source: string;
        target: string;
        condition?: string | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    name: string;
    nodes: {
        type: "webhook" | "email" | "content" | "ai" | "trigger" | "condition" | "transform" | "human" | "schedule" | "loop";
        config: Record<string, any>;
        id: string;
        position: {
            x: number;
            y: number;
        };
        label?: string | undefined;
    }[];
    edges: {
        id: string;
        source: string;
        target: string;
        condition?: string | undefined;
    }[];
    description?: string | undefined;
    id?: string | undefined;
}, {
    name: string;
    nodes: {
        type: "webhook" | "email" | "content" | "ai" | "trigger" | "condition" | "transform" | "human" | "schedule" | "loop";
        id: string;
        position: {
            x: number;
            y: number;
        };
        config?: Record<string, any> | undefined;
        label?: string | undefined;
    }[];
    edges: {
        id: string;
        source: string;
        target: string;
        condition?: string | undefined;
    }[];
    description?: string | undefined;
    id?: string | undefined;
}>;
export type WorkflowDsl = z.infer<typeof workflowDslSchema>;
export interface ExecutionContext {
    workflowId: string;
    runId: string;
    organizationId: string;
    input: Record<string, unknown>;
    outputs: Record<string, unknown>;
    states: Record<string, string>;
    logs: {
        nodeId: string;
        level: string;
        message: string;
        data?: unknown;
        ts: string;
    }[];
}
export interface NodeExecutor {
    type: NodeType;
    execute(node: WorkflowNode, ctx: ExecutionContext): Promise<unknown>;
}
export declare function evalExpr(expr: string, ctx: ExecutionContext): unknown;
export declare function validateDag(dsl: WorkflowDsl): {
    ok: boolean;
    errors: string[];
};
export declare class WorkflowEngine {
    private executors;
    register(exec: NodeExecutor): void;
    run(dsl: WorkflowDsl, ctx: ExecutionContext): Promise<ExecutionContext>;
}
//# sourceMappingURL=index.d.ts.map