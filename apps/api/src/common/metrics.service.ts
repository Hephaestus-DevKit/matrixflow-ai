import { Injectable } from '@nestjs/common';
import { collectDefaultMetrics, Counter, Histogram, Registry } from 'prom-client';

@Injectable()
export class MetricsService {
  private readonly registry = new Registry();
  private readonly requests = new Counter({
    name: 'matrixflow_http_requests_total',
    help: 'Total HTTP requests handled by the API',
    labelNames: ['method', 'route', 'status'] as const,
    registers: [this.registry],
  });
  private readonly duration = new Histogram({
    name: 'matrixflow_http_request_duration_seconds',
    help: 'HTTP request duration in seconds',
    labelNames: ['method', 'route', 'status'] as const,
    buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10],
    registers: [this.registry],
  });

  constructor() {
    collectDefaultMetrics({ register: this.registry, prefix: 'matrixflow_' });
  }

  observeHttp(method: string, route: string, status: number, seconds: number) {
    const labels = { method, route, status: String(status) };
    this.requests.inc(labels);
    this.duration.observe(labels, seconds);
  }

  contentType() {
    return this.registry.contentType;
  }
  render() {
    return this.registry.metrics();
  }
}
