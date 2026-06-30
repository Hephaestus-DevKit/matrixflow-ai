import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Request } from 'express';
import { ErrorCode, RoleName } from '@matrixflow/shared';
import { ReqUser } from '../common/interceptors/org.interceptor';

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<Request>();
    const u = req.user as ReqUser;
    // 简化：role=owner 视为平台管理员。生产应有独立 platform_admin 标志位。
    if (u?.role !== RoleName.OWNER) throw new ForbiddenException(ErrorCode.FORBIDDEN);
    return true;
  }
}
