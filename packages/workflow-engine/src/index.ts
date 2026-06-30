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

export class WorkflowEngine {
  async execute(dsl: WorkflowDSL, input: unknown, ctx: ExecutionContext): Promise<unknown> {
    const sorted = this.topoSort(dsl.nodes, dsl.edges);
    const state: Record<string, unknown> = { __input: input };
    for (const node of sorted) {
      const start = Date.now();
      state[node.id] = await this.runNode(node, state, ctx);
    }
    const last = sorted.filter((n) => n.type !== 'trigger').pop();
    return last ? state[last.id] : state;
  }

  private async runNode(node: WorkflowNode, state: Record<string, unknown>, ctx: ExecutionContext): Promise<unknown> {
    // 节点执行逻辑由后端 AiService / 外部服务注入
    return { nodeId: node.id, type: node.type, config: node.config };
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
    if (!dsl.nodes?.length) errors.push('No nodes');
    const ids = new Set(dsl.nodes.map((n) => n.id));
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
