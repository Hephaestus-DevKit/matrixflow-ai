import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { tap } from 'rxjs';
import { Request } from 'express';

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  intercept(ctx: ExecutionContext, next: CallHandler) {
    const req = ctx.switchToHttp().getRequest<Request>();
    const start = Date.now();
    return next.handle().pipe(tap(() => {
      const ms = Date.now() - start;
      if (ms > 2000) console.warn(`[slow] ${req.method} ${req.url} ${ms}ms`);
    }));
  }
}
