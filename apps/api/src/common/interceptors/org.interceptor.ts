import { Injectable, NestInterceptor, ExecutionContext, CallHandler, SetMetadata } from '@nestjs/common';
import { Request } from 'express';

// 从 JWT 解出的请求上下文 (挂到 req.user)
export interface ReqUser {
  id: string;
  email: string;
  name: string;
  organizationId?: string;
  role?: string;
  permissions?: string[];
}

declare module 'express' {
  interface Request { user?: ReqUser; }
}

@Injectable()
export class OrgInterceptor implements NestInterceptor {
  intercept(ctx: ExecutionContext, next: CallHandler) {
    const req = ctx.switchToHttp().getRequest<Request>();
    const headerOrg = req.headers['x-organization-id'] as string | undefined;
    if (req.user && headerOrg) req.user.organizationId = headerOrg;
    return next.handle();
  }
}

// 装饰器：声明端点所需权限
export const PERMS_KEY = 'perms';
export const RequireAction = (...actions: string[]) => SetMetadata(PERMS_KEY, actions);
