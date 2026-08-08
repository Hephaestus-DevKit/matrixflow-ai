// @matrixflow/workflow-engine · 工作流 DSL + DAG 执行器
import {
  WORKFLOW_NODE_TYPES,
  workflowDslSchema,
  type ExecutionContext,
  type WorkflowDSL,
  type WorkflowEdge,
  type WorkflowNode,
} from '@matrixflow/shared';

export type { ExecutionContext, WorkflowDSL, WorkflowEdge, WorkflowNode } from '@matrixflow/shared';

export interface NodeResult {
  nodeId: string;
  output: unknown;
  durationMs: number;
}

export type WorkflowNodeHandler = (
  node: WorkflowNode,
  input: unknown,
  context: ExecutionContext,
) => Promise<unknown>;

const SKIPPED = Symbol('workflow-node-skipped');

export class WorkflowEngine {
  constructor(
    private readonly handlers: Partial<Record<WorkflowNode['type'], WorkflowNodeHandler>> = {},
  ) {}

  async execute(dsl: WorkflowDSL, input: unknown, ctx: ExecutionContext): Promise<unknown> {
    const validation = this.validate(dsl);
    if (!validation.valid) throw new Error(`Invalid workflow: ${validation.errors.join('; ')}`);
    const sorted = this.topoSort(dsl.nodes, dsl.edges);
    const incomingByNode = new Map<string, WorkflowEdge[]>(dsl.nodes.map((node) => [node.id, []]));
    for (const edge of dsl.edges) incomingByNode.get(edge.target)?.push(edge);
    const state: Record<string, unknown | typeof SKIPPED> = { __input: input };
    for (const node of sorted) {
      const incoming = incomingByNode.get(node.id) ?? [];
      const sources = incoming
        .filter((edge) => {
          const sourceOutput = state[edge.source];
          return sourceOutput !== SKIPPED && this.edgeMatches(edge, sourceOutput);
        })
        .map((edge) => edge.source);
      if (incoming.length > 0 && sources.length === 0) {
        state[node.id] = SKIPPED;
        continue;
      }
      const nodeInput =
        sources.length === 0
          ? input
          : sources.length === 1
            ? state[sources[0]]
            : Object.fromEntries(sources.map((source) => [source, state[source]]));
      state[node.id] = await this.runNode(node, nodeInput, ctx);
    }
    const last = sorted
      .filter((node) => node.type !== 'trigger' && state[node.id] !== SKIPPED)
      .pop();
    return last ? state[last.id] : input;
  }

  private edgeMatches(edge: WorkflowEdge, sourceOutput: unknown): boolean {
    switch (edge.condition ?? 'always') {
      case 'always':
        return true;
      case 'true':
        return sourceOutput === true;
      case 'false':
        return sourceOutput === false;
      case 'truthy':
        return Boolean(sourceOutput);
      case 'falsy':
        return !sourceOutput;
    }
    return false;
  }

  private async runNode(
    node: WorkflowNode,
    input: unknown,
    ctx: ExecutionContext,
  ): Promise<unknown> {
    if (node.type === 'trigger') return input;
    const handler = this.handlers[node.type];
    if (!handler) throw new Error(`No handler registered for workflow node type: ${node.type}`);
    return handler(node, input, ctx);
  }

  private topoSort(nodes: WorkflowNode[], edges: WorkflowEdge[]): WorkflowNode[] {
    const nodesById = new Map(nodes.map((node) => [node.id, node]));
    const indeg = new Map<string, number>(nodes.map((n) => [n.id, 0]));
    const adj = new Map<string, string[]>(nodes.map((n) => [n.id, [] as string[]]));
    for (const e of edges) {
      adj.get(e.source)?.push(e.target);
      indeg.set(e.target, (indeg.get(e.target) ?? 0) + 1);
    }
    const q: string[] = nodes.filter((n) => (indeg.get(n.id) ?? 0) === 0).map((n) => n.id);
    const out: WorkflowNode[] = [];
    for (let cursor = 0; cursor < q.length; cursor++) {
      const id = q[cursor];
      const node = nodesById.get(id);
      if (!node) continue;
      out.push(node);
      for (const next of adj.get(id) ?? []) {
        indeg.set(next, (indeg.get(next) ?? 1) - 1);
        if ((indeg.get(next) ?? 0) === 0) q.push(next);
      }
    }
    return out;
  }

  validate(dsl: WorkflowDSL): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    if (!Array.isArray(dsl?.nodes) || !dsl.nodes.length)
      return { valid: false, errors: ['No nodes'] };
    if (!Array.isArray(dsl.edges)) return { valid: false, errors: ['No edges array'] };
    const ids = new Set(dsl.nodes.map((n) => n.id));
    if (ids.size !== dsl.nodes.length) errors.push('Duplicate node IDs');
    const shape = workflowDslSchema.safeParse(dsl);
    if (!shape.success) {
      errors.push(...shape.error.issues.map((issue) => issue.message));
      return { valid: false, errors };
    }
    const allowedTypes = new Set<WorkflowNode['type']>(WORKFLOW_NODE_TYPES);
    for (const node of dsl.nodes)
      if (!allowedTypes.has(node.type)) errors.push(`Unsupported node type ${node.type}`);
    for (const e of dsl.edges) {
      if (!ids.has(e.source)) errors.push(`Edge source ${e.source} not found`);
      if (!ids.has(e.target)) errors.push(`Edge target ${e.target} not found`);
      if (e.source === e.target) errors.push(`Self edge ${e.source} is not allowed`);
    }
    const edgeKeys = new Set(dsl.edges.map((edge) => `${edge.source}\u0000${edge.target}`));
    if (edgeKeys.size !== dsl.edges.length) errors.push('Duplicate edges');
    // 检测环
    const visited = new Set<string>();
    const stack = new Set<string>();
    const adj = new Map<string, string[]>();
    for (const n of dsl.nodes) adj.set(n.id, []);
    for (const e of dsl.edges) adj.get(e.source)?.push(e.target);
    const hasCycle = (id: string): boolean => {
      if (stack.has(id)) return true;
      if (visited.has(id)) return false;
      visited.add(id);
      stack.add(id);
      for (const next of adj.get(id) ?? []) if (hasCycle(next)) return true;
      stack.delete(id);
      return false;
    };
    for (const n of dsl.nodes)
      if (hasCycle(n.id)) {
        errors.push('Cycle detected');
        break;
      }
    return { valid: errors.length === 0, errors };
  }
}
