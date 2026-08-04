import { BadRequestException, Injectable, NotImplementedException } from '@nestjs/common';
import { lookup } from 'dns/promises';
import { isIP } from 'net';
import { Agent, fetch as undiciFetch } from 'undici';
import { AiService } from '../ai/ai.service';
import {
  WorkflowDSL,
  WorkflowEngine,
  WorkflowNode,
  ExecutionContext,
} from '@matrixflow/workflow-engine';

@Injectable()
export class WorkflowExecutor {
  private readonly engine: WorkflowEngine;

  constructor(private readonly ai: AiService) {
    this.engine = new WorkflowEngine({
      ai: (node, inputs, context) => this.runAiNode(node, inputs, context),
      content: (node, inputs, context) => this.runAiNode(node, inputs, context),
      condition: async (node, inputs) => this.evaluateCondition(node.config ?? {}, inputs),
      transform: async (node, inputs) => this.runTransform(node, inputs),
      webhook: (node, inputs) => this.callWebhook(node.config ?? {}, inputs),
      email: async () => {
        throw new NotImplementedException('Email workflow nodes require an SMTP delivery adapter');
      },
      human: async () => {
        throw new NotImplementedException(
          'Human approval nodes require a persisted pause/resume state',
        );
      },
      schedule: async () => {
        throw new NotImplementedException('Schedule nodes must be configured as workflow triggers');
      },
      loop: async () => {
        throw new NotImplementedException(
          'Loop nodes require explicit iteration limits and are not enabled',
        );
      },
    });
  }

  async execute(dsl: WorkflowDSL, input: unknown, context: ExecutionContext): Promise<unknown> {
    const validation = this.engine.validate(dsl);
    if (!validation.valid) throw new BadRequestException(validation.errors.join('; '));
    return this.engine.execute(dsl, input, context);
  }

  private runAiNode(node: WorkflowNode, inputs: unknown, context: ExecutionContext) {
    const config = node.config ?? {};
    const promptKey = this.requiredString(config.promptKey, `${node.type}.promptKey`);
    return this.ai.runPrompt({
      promptKey,
      variables: { input: JSON.stringify(inputs), ...(this.record(config.variables) ?? {}) },
      organizationId: context.organizationId,
      userId: context.userId,
    });
  }

  private runTransform(node: WorkflowNode, inputs: unknown): string {
    const template = this.requiredString(node.config?.template, 'transform.template');
    return template.replace(/\{\{\s*([^}]+)\s*\}\}/g, (_match, path: string) =>
      String(this.resolvePath(inputs, path.trim()) ?? ''),
    );
  }

  private evaluateCondition(config: Record<string, unknown>, inputs: unknown): boolean {
    const field = this.requiredString(config.field, 'condition.field');
    const operator = this.requiredString(config.operator, 'condition.operator');
    const actual = this.resolvePath(inputs, field);
    const expected = config.value;
    switch (operator) {
      case 'eq':
        return actual === expected;
      case 'ne':
        return actual !== expected;
      case 'gt':
        return Number(actual) > Number(expected);
      case 'gte':
        return Number(actual) >= Number(expected);
      case 'lt':
        return Number(actual) < Number(expected);
      case 'lte':
        return Number(actual) <= Number(expected);
      case 'contains':
        return typeof actual === 'string' && actual.includes(String(expected));
      case 'truthy':
        return Boolean(actual);
      default:
        throw new BadRequestException(`Unsupported condition operator: ${operator}`);
    }
  }

  private async callWebhook(config: Record<string, unknown>, inputs: unknown) {
    const url = new URL(this.requiredString(config.url, 'webhook.url'));
    const address = await this.resolveSafeWebhook(url);
    const configuredHeaders = this.record(config.headers) ?? {};
    const headers = Object.fromEntries(
      Object.entries(configuredHeaders).map(([key, value]) => [key.toLowerCase(), String(value)]),
    );
    delete headers.host;
    delete headers['content-length'];
    const method = typeof config.method === 'string' ? config.method.toUpperCase() : 'POST';
    if (!['POST', 'PUT', 'PATCH'].includes(method))
      throw new BadRequestException('Webhook method must be POST, PUT, or PATCH');
    const dispatcher = new Agent({
      connections: 1,
      pipelining: 0,
      connect: {
        lookup: (_hostname, _options, callback) => callback(null, address.address, address.family),
      },
    });
    try {
      const response = await undiciFetch(url, {
        method,
        headers: { 'content-type': 'application/json', ...headers },
        body: JSON.stringify(inputs),
        redirect: 'error',
        signal: AbortSignal.timeout(Number(process.env.WORKFLOW_WEBHOOK_TIMEOUT_MS ?? 15_000)),
        dispatcher,
      });
      const body = await this.readLimitedBody(
        response,
        Number(process.env.WORKFLOW_WEBHOOK_MAX_RESPONSE_BYTES ?? 1_000_000),
      );
      if (!response.ok)
        throw new Error(`Webhook returned ${response.status}: ${body.slice(0, 500)}`);
      return {
        statusCode: response.status,
        body,
        contentType: response.headers.get('content-type'),
      };
    } finally {
      await dispatcher.close();
    }
  }

  private async resolveSafeWebhook(url: URL): Promise<{ address: string; family: 4 | 6 }> {
    if (
      !['https:', ...(process.env.NODE_ENV === 'production' ? [] : ['http:'])].includes(
        url.protocol,
      )
    ) {
      throw new BadRequestException('Webhook URL must use HTTPS');
    }
    if (url.username || url.password)
      throw new BadRequestException('Webhook URL credentials are not allowed');
    const hostname = url.hostname.toLowerCase();
    if (
      hostname === 'localhost' ||
      hostname.endsWith('.local') ||
      hostname === 'metadata.google.internal'
    ) {
      throw new BadRequestException('Private webhook destinations are not allowed');
    }
    const literalFamily = isIP(hostname);
    const addresses = literalFamily
      ? [{ address: hostname, family: literalFamily }]
      : await lookup(hostname, { all: true, verbatim: true });
    if (!addresses.length || addresses.some(({ address }) => this.isPrivateAddress(address))) {
      throw new BadRequestException('Private webhook destinations are not allowed');
    }
    const selected = addresses[0];
    return { address: selected.address, family: selected.family as 4 | 6 };
  }

  private isPrivateAddress(address: string): boolean {
    const normalized = address.toLowerCase().replace(/^::ffff:/, '');
    if (
      normalized === '::1' ||
      normalized === '::' ||
      normalized.startsWith('fc') ||
      normalized.startsWith('fd') ||
      normalized.startsWith('fe80:') ||
      normalized.startsWith('ff')
    )
      return true;
    const parts = normalized.split('.').map(Number);
    if (parts.length !== 4 || parts.some(Number.isNaN)) return false;
    const [a, b] = parts;
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      a >= 224
    );
  }

  private async readLimitedBody(
    response: Awaited<ReturnType<typeof undiciFetch>>,
    maxBytes: number,
  ): Promise<string> {
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
    for (const chunk of chunks) {
      merged.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return new TextDecoder().decode(merged);
  }

  private resolvePath(value: unknown, path: string): unknown {
    return path.split('.').reduce<unknown>((current, key) => this.record(current)?.[key], value);
  }

  private record(value: unknown): Record<string, unknown> | undefined {
    return value !== null && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : undefined;
  }

  private requiredString(value: unknown, field: string): string {
    if (typeof value !== 'string' || !value.trim())
      throw new BadRequestException(`${field} is required`);
    return value.trim();
  }
}
