// @matrixflow/workflow-engine · 工作流 DSL + DAG 执行器
export interface WorkflowNode {
  id: string;
  type: 'trigger' | 'ai' | 'condition' | 'transform' | 'webhook' | 'email' | 'content' | 'human' | 'schedule' | 'loop';
  config: Record<string, unknown>;
  position: { x: number; y: number };
}

export interface WorkflowEdge {
  source: string;
  target: string;
  condition?: string;
}

export interface WorkflowDSL {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

export interface ExecutionContext {
  organizationId: string;
  userId: string;
  workflowId: string;
  runId: string;
}

export interface NodeResult {
  nodeId: string;
  output: unknown;
  durationMs: number;
}

export type WorkflowNodeHandler = (node: WorkflowNode, input: unknown, context: ExecutionContext) => Promise<unknown>;

export class WorkflowEngine {
  constructor(private readonly handlers: Partial<Record<WorkflowNode['type'], WorkflowNodeHandler>> = {}) {}

  async execute(dsl: WorkflowDSL, input: unknown, ctx: ExecutionContext): Promise<unknown> {
    const validation = this.validate(dsl);
    if (!validation.valid) throw new Error(`Invalid workflow: ${validation.errors.join('; ')}`);
    const sorted = this.topoSort(dsl.nodes, dsl.edges);
    const state: Record<string, unknown> = { __input: input };
    for (const node of sorted) {
      const sources = dsl.edges.filter((edge) => edge.target === node.id).map((edge) => edge.source);
      const nodeInput = sources.length === 0 ? input : sources.length === 1 ? state[sources[0]] : Object.fromEntries(sources.map((source) => [source, state[source]]));
      state[node.id] = await this.runNode(node, nodeInput, ctx);
    }
    const last = sorted.filter((n) => n.type !== 'trigger').pop();
    return last ? state[last.id] : state;
  }

  private async runNode(node: WorkflowNode, input: unknown, ctx: ExecutionContext): Promise<unknown> {
    if (node.type === 'trigger') return input;
    const handler = this.handlers[node.type];
    if (!handler) throw new Error(`No handler registered for workflow node type: ${node.type}`);
    return handler(node, input, ctx);
  }

  private topoSort(nodes: WorkflowNode[], edges: WorkflowEdge[]): WorkflowNode[] {
    const indeg = new Map<string, number>(nodes.map((n) => [n.id, 0]));
    const adj = new Map<string, string[]>(nodes.map((n) => [n.id, [] as string[]]));
    for (const e of edges) {
      adj.get(e.source)?.push(e.target);
      indeg.set(e.target, (indeg.get(e.target) ?? 0) + 1);
    }
    const q: string[] = nodes.filter((n) => (indeg.get(n.id) ?? 0) === 0).map((n) => n.id);
    const out: WorkflowNode[] = [];
    while (q.length) {
      const id = q.shift()!;
      out.push(nodes.find((n) => n.id === id)!);
      for (const next of adj.get(id) ?? []) {
        indeg.set(next, (indeg.get(next) ?? 1) - 1);
        if ((indeg.get(next) ?? 0) === 0) q.push(next);
      }
    }
    return out;
  }

  validate(dsl: WorkflowDSL): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    if (!Array.isArray(dsl?.nodes) || !dsl.nodes.length) return { valid: false, errors: ['No nodes'] };
    if (!Array.isArray(dsl.edges)) return { valid: false, errors: ['No edges array'] };
    const ids = new Set(dsl.nodes.map((n) => n.id));
    if (ids.size !== dsl.nodes.length) errors.push('Duplicate node IDs');
    for (const e of dsl.edges) {
      if (!ids.has(e.source)) errors.push(`Edge source ${e.source} not found`);
      if (!ids.has(e.target)) errors.push(`Edge target ${e.target} not found`);
    }
    // 检测环
    const visited = new Set<string>();
    const stack = new Set<string>();
    const adj = new Map<string, string[]>();
    for (const n of dsl.nodes) adj.set(n.id, []);
    for (const e of dsl.edges) adj.get(e.source)?.push(e.target);
    const hasCycle = (id: string): boolean => {
      if (stack.has(id)) return true;
      if (visited.has(id)) return false;
      visited.add(id); stack.add(id);
      for (const next of adj.get(id) ?? []) if (hasCycle(next)) return true;
      stack.delete(id); return false;
    };
    for (const n of dsl.nodes) if (hasCycle(n.id)) { errors.push('Cycle detected'); break; }
    return { valid: errors.length === 0, errors };
  }
}
