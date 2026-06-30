// 从 JWT claim / header / query 解析 organizationId，注入 req.organizationId
import { CallHandler, ExecutionContext, Injectable, NestInterceptor, BadRequestException } from '@nestjs/common';
import { Request } from 'express';
import { Observable } from 'rxjs';

@Injectable()
export class OrganizationInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request & { user?: { organizationId?: string }; organizationId?: string }>();
    const orgId = req.user?.organizationId || (req.headers['x-organization-id'] as string) || (req.query.organizationId as string);
    if (!orgId) {
      // 公开端点（/auth/* /health）由 Public 装饰器跳过 Guard，这里也放行
      if (req.url.startsWith('/api/v1/auth') || req.url.startsWith('/api/v1/health')) {
        return next.handle();
      }
      throw new BadRequestException('Missing organization context');
    }
    req.organizationId = orgId;
    return next.handle();
  }
}
