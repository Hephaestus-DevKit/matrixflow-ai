import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { ErrorCode } from '@matrixflow/shared';
import { ReqUser } from '../common/auth-context';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<Request>();
    const u = req.user as ReqUser;
    const ids = this.config
      .get<string>('PLATFORM_ADMIN_IDS', '')
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);
    if (!u || !ids.includes(u.id)) {
      throw new ForbiddenException(ErrorCode.FORBIDDEN);
    }
    return true;
  }
}
