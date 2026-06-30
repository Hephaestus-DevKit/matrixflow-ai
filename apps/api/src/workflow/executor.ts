// 工作流 DAG 执行器 (简化版，生产环境移至 packages/workflow-engine)
import { Injectable } from '@nestjs/common';

interface Node { id: string; type: string; config: any; }
interface Edge { source: string; target: string; condition?: string; }
interface DSL { nodes: Node[]; edges: Edge[]; }
interface Ctx { organizationId: string; userId: string; workflowId: string; runId: string; }

@Injectable()
export class WorkflowExecutor {
  async execute(dsl: DSL, input: any, ctx: Ctx): Promise<any> {
    if (!dsl?.nodes?.length) return { output: null };
    // 拓扑排序
    const sorted = this.topoSort(dsl.nodes, dsl.edges);
    const state: Record<string, any> = { __input: input };
    for (const node of sorted) {
      state[node.id] = await this.runNode(node, state, ctx);
    }
    // 返回最后一个非 trigger 节点的输出
    const last = sorted.filter((n) => n.type !== 'trigger').pop();
    return last ? state[last.id] : state;
  }

  private async runNode(node: Node, state: Record<string, any>, ctx: Ctx): Promise<any> {
    const inputs = this.collectInputs(node, state);
    switch (node.type) {
      case 'trigger': return inputs;
      case 'ai': return { content: `(AI output for ${node.config.promptKey || 'default'})`, inputs };
      case 'condition': return node.config?.expression ? Math.random() > 0.5 : true;
      case 'transform': return node.config?.template ? { transformed: true } : inputs;
      case 'webhook': return { statusCode: 200, body: inputs };
      case 'email': return { sent: true, to: node.config?.to };
      case 'content': return { generated: true, type: node.config?.type };
      case 'human': return { pending: true };
      case 'schedule': return { scheduled: true };
      case 'loop': return { iterated: true };
      default: return inputs;
    }
  }

  private collectInputs(node: Node, state: Record<string, any>): any {
    return Object.fromEntries(Object.entries(state).filter(([k]) => k !== '__input'));
  }

  private topoSort(nodes: Node[], edges: Edge[]): Node[] {
    const indeg = new Map<string, number>(nodes.map((n) => [n.id, 0]));
    const adj = new Map<string, string[]>(nodes.map((n) => [n.id, []]));
    for (const e of edges) { adj.get(e.source)?.push(e.target); indeg.set(e.target, (indeg.get(e.target) ?? 0) + 1); }
    const q = nodes.filter((n) => (indeg.get(n.id) ?? 0) === 0).map((n) => n.id);
    const out: Node[] = [];
    while (q.length) {
      const id = q.shift()!;
      const n = nodes.find((x) => x.id === id)!;
      out.push(n);
      for (const next of adj.get(id) ?? []) { indeg.set(next, (indeg.get(next) ?? 1) - 1); if ((indeg.get(next) ?? 0) === 0) q.push(next); }
    }
    return out;
  }
}
