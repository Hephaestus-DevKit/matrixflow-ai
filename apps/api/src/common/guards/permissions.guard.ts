// 权限 Guard：根据用户角色查 permissions 表
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/require-permissions.decorator';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly prisma: PrismaService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [ctx.getHandler(), ctx.getClass()]);
    if (!required || required.length === 0) return true;
    const req = ctx.switchToHttp().getRequest<{ user?: { roleId: string; role: string } }>();
    if (!req.user) return false;
    if (req.user.role === 'owner') return true; // owner 全权限
    const perms = await this.prisma.permission.findMany({ where: { roleId: req.user.roleId }, select: { action: true } });
    const have = new Set(perms.map((p: any) => p.action));
    return required.every((p) => have.has(p));
  }
}
