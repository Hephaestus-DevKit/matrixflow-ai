import { BadRequestException, Injectable, NotImplementedException } from '@nestjs/common';
import { lookup } from 'dns/promises';
import { isIP } from 'net';
import { AiService } from '../ai/ai.service';

interface WorkflowNode { id: string; type: string; config?: Record<string, unknown>; }
interface WorkflowEdge { source: string; target: string; condition?: string; }
interface WorkflowDsl { nodes: WorkflowNode[]; edges: WorkflowEdge[]; }
interface WorkflowContext { organizationId: string; userId: string; workflowId: string; runId: string; }

@Injectable()
export class WorkflowExecutor {
  constructor(private readonly ai: AiService) {}

  async execute(dsl: WorkflowDsl, input: unknown, context: WorkflowContext): Promise<unknown> {
    if (!dsl?.nodes?.length) throw new BadRequestException('Workflow must contain at least one node');
    const sorted = this.topoSort(dsl.nodes, dsl.edges ?? []);
    const state: Record<string, unknown> = { __input: input };
    for (const node of sorted) {
      const inputs = this.collectInputs(node, state, dsl.edges ?? []);
      state[node.id] = await this.runNode(node, inputs, context);
    }
    const last = [...sorted].reverse().find((node) => node.type !== 'trigger');
    return last ? state[last.id] : input;
  }

  private async runNode(node: WorkflowNode, inputs: unknown, context: WorkflowContext): Promise<unknown> {
    const config = node.config ?? {};
    switch (node.type) {
      case 'trigger':
        return inputs;
      case 'ai':
      case 'content': {
        const promptKey = this.requiredString(config.promptKey, `${node.type}.promptKey`);
        return this.ai.runPrompt({
          promptKey,
          variables: { input: JSON.stringify(inputs), ...(this.record(config.variables) ?? {}) },
          organizationId: context.organizationId,
          userId: context.userId,
        });
      }
      case 'condition':
        return this.evaluateCondition(config, inputs);
      case 'transform': {
        const template = this.requiredString(config.template, 'transform.template');
        return template.replace(/\{\{\s*([^}]+)\s*\}\}/g, (_match, path: string) => String(this.resolvePath(inputs, path.trim()) ?? ''));
      }
      case 'webhook':
        return this.callWebhook(config, inputs);
      case 'email':
        throw new NotImplementedException('Email workflow nodes require an SMTP delivery adapter');
      case 'human':
        throw new NotImplementedException('Human approval nodes require a persisted pause/resume state');
      case 'schedule':
        throw new NotImplementedException('Schedule nodes must be configured as workflow triggers');
      case 'loop':
        throw new NotImplementedException('Loop nodes require explicit iteration limits and are not enabled');
      default:
        throw new BadRequestException(`Unsupported workflow node type: ${node.type}`);
    }
  }

  private evaluateCondition(config: Record<string, unknown>, inputs: unknown): boolean {
    const field = this.requiredString(config.field, 'condition.field');
    const operator = this.requiredString(config.operator, 'condition.operator');
    const actual = this.resolvePath(inputs, field);
    const expected = config.value;
    switch (operator) {
      case 'eq': return actual === expected;
      case 'ne': return actual !== expected;
      case 'gt': return Number(actual) > Number(expected);
      case 'gte': return Number(actual) >= Number(expected);
      case 'lt': return Number(actual) < Number(expected);
      case 'lte': return Number(actual) <= Number(expected);
      case 'contains': return typeof actual === 'string' && actual.includes(String(expected));
      case 'truthy': return Boolean(actual);
      default: throw new BadRequestException(`Unsupported condition operator: ${operator}`);
    }
  }

  private async callWebhook(config: Record<string, unknown>, inputs: unknown) {
    const url = new URL(this.requiredString(config.url, 'webhook.url'));
    await this.assertSafeWebhook(url);
    const configuredHeaders = this.record(config.headers) ?? {};
    const headers = Object.fromEntries(Object.entries(configuredHeaders).map(([key, value]) => [key.toLowerCase(), String(value)]));
    delete headers.host;
    delete headers['content-length'];
    const method = typeof config.method === 'string' ? config.method.toUpperCase() : 'POST';
    if (!['POST', 'PUT', 'PATCH'].includes(method)) throw new BadRequestException('Webhook method must be POST, PUT, or PATCH');
    const response = await fetch(url, {
      method,
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(inputs),
      redirect: 'error',
      signal: AbortSignal.timeout(Number(process.env.WORKFLOW_WEBHOOK_TIMEOUT_MS ?? 15_000)),
    });
    const body = await this.readLimitedBody(response, Number(process.env.WORKFLOW_WEBHOOK_MAX_RESPONSE_BYTES ?? 1_000_000));
    if (!response.ok) throw new Error(`Webhook returned ${response.status}: ${body.slice(0, 500)}`);
    return { statusCode: response.status, body, contentType: response.headers.get('content-type') };
  }

  private async assertSafeWebhook(url: URL) {
    if (!['https:', ...(process.env.NODE_ENV === 'production' ? [] : ['http:'])].includes(url.protocol)) {
      throw new BadRequestException('Webhook URL must use HTTPS');
    }
    if (url.username || url.password) throw new BadRequestException('Webhook URL credentials are not allowed');
    const hostname = url.hostname.toLowerCase();
    if (hostname === 'localhost' || hostname.endsWith('.local') || hostname === 'metadata.google.internal') {
      throw new BadRequestException('Private webhook destinations are not allowed');
    }
    const addresses = isIP(hostname) ? [{ address: hostname }] : await lookup(hostname, { all: true, verbatim: true });
    if (!addresses.length || addresses.some(({ address }) => this.isPrivateAddress(address))) {
      throw new BadRequestException('Private webhook destinations are not allowed');
    }
  }

  private isPrivateAddress(address: string): boolean {
    const normalized = address.toLowerCase().replace(/^::ffff:/, '');
    if (normalized === '::1' || normalized === '::' || normalized.startsWith('fc') || normalized.startsWith('fd') || normalized.startsWith('fe80:')) return true;
    const parts = normalized.split('.').map(Number);
    if (parts.length !== 4 || parts.some(Number.isNaN)) return false;
    const [a, b] = parts;
    return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a >= 224;
  }

  private async readLimitedBody(response: Response, maxBytes: number): Promise<string> {
    if (!response.body) return '';
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw new Error(`Webhook response exceeds ${maxBytes} bytes`);
      }
      chunks.push(value);
    }
    const merged = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) { merged.set(chunk, offset); offset += chunk.byteLength; }
    return new TextDecoder().decode(merged);
  }

  private collectInputs(node: WorkflowNode, state: Record<string, unknown>, edges: WorkflowEdge[]): unknown {
    const sources = edges.filter((edge) => edge.target === node.id).map((edge) => edge.source);
    if (!sources.length) return state.__input;
    if (sources.length === 1) return state[sources[0]];
    return Object.fromEntries(sources.map((source) => [source, state[source]]));
  }

  private topoSort(nodes: WorkflowNode[], edges: WorkflowEdge[]): WorkflowNode[] {
    const byId = new Map(nodes.map((node) => [node.id, node]));
    if (byId.size !== nodes.length) throw new BadRequestException('Workflow node IDs must be unique');
    const indegree = new Map(nodes.map((node) => [node.id, 0]));
    const adjacency = new Map(nodes.map((node) => [node.id, [] as string[]]));
    for (const edge of edges) {
      if (!byId.has(edge.source) || !byId.has(edge.target)) throw new BadRequestException('Workflow edge references an unknown node');
      adjacency.get(edge.source)!.push(edge.target);
      indegree.set(edge.target, indegree.get(edge.target)! + 1);
    }
    const queue = nodes.filter((node) => indegree.get(node.id) === 0).map((node) => node.id);
    const sorted: WorkflowNode[] = [];
    while (queue.length) {
      const id = queue.shift()!;
      sorted.push(byId.get(id)!);
      for (const target of adjacency.get(id)!) {
        const remaining = indegree.get(target)! - 1;
        indegree.set(target, remaining);
        if (remaining === 0) queue.push(target);
      }
    }
    if (sorted.length !== nodes.length) throw new BadRequestException('Workflow contains a cycle');
    return sorted;
  }

  private resolvePath(value: unknown, path: string): unknown {
    return path.split('.').reduce<unknown>((current, key) => this.record(current)?.[key], value);
  }

  private record(value: unknown): Record<string, unknown> | undefined {
    return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
  }

  private requiredString(value: unknown, field: string): string {
    if (typeof value !== 'string' || !value.trim()) throw new BadRequestException(`${field} is required`);
    return value.trim();
  }
}
