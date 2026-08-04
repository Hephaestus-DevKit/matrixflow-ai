import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { finalize } from 'rxjs';
import { Request } from 'express';
import { MetricsService } from '../metrics.service';

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly metrics: MetricsService) {}

  intercept(ctx: ExecutionContext, next: CallHandler) {
    const req = ctx.switchToHttp().getRequest<Request>();
    const start = Date.now();
    return next.handle().pipe(
      finalize(() => {
        const ms = Date.now() - start;
        const route = req.route?.path
          ? `${req.baseUrl}${req.route.path}`
          : req.baseUrl || 'unknown';
        this.metrics.observeHttp(
          req.method,
          route,
          ctx.switchToHttp().getResponse().statusCode,
          ms / 1_000,
        );
      }),
    );
  }
}
