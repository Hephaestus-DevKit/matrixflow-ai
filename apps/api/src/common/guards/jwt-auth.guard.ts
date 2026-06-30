import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { ErrorCode } from '@matrixflow/shared';
import { PERMS_KEY } from '../interceptors/org.interceptor';
import { AuthService } from '../../auth/auth.service';
import { ConfigService } from '@nestjs/config';
import { Client, Account } from 'node-appwrite';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private authService: AuthService,
    private cfg: ConfigService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>('isPublic', [ctx.getHandler(), ctx.getClass()]);
    if (isPublic) return true;
    const req = ctx.switchToHttp().getRequest<Request>();
    const token = this.extract(req);
    if (!token) throw new UnauthorizedException(ErrorCode.UNAUTHORIZED);

    try {
      // Initialize Appwrite Client with the user's JWT
      const client = new Client()
        .setEndpoint(this.cfg.get<string>('APPWRITE_ENDPOINT', 'https://cloud.appwrite.io/v1'))
        .setProject(this.cfg.get<string>('APPWRITE_PROJECT_ID', ''));
      
      client.setJWT(token);

      const appwriteAccount = new Account(client);
      const appwriteUser = await appwriteAccount.get();
      
      // Auto-sync / verify user context in our PostgreSQL database
      const syncedUser = await this.authService.syncUser(appwriteUser);
      
      req.user = {
        id: syncedUser.id,
        email: syncedUser.email,
        name: syncedUser.name,
        organizationId: syncedUser.organizationId,
        role: syncedUser.role,
        permissions: syncedUser.permissions ?? [],
      };
    } catch (err) {
      throw new UnauthorizedException(ErrorCode.TOKEN_INVALID);
    }

    const required = this.reflector.getAllAndOverride<string[]>(PERMS_KEY, [ctx.getHandler(), ctx.getClass()]);
    if (required?.length && !required.some((p) => req.user?.permissions?.includes(p))) {
      throw new UnauthorizedException(ErrorCode.FORBIDDEN);
    }
    return true;
  }

  private extract(req: Request): string | undefined {
    const h = req.headers.authorization;
    if (h?.startsWith('Bearer ')) return h.slice(7);
    return undefined;
  }
}

import { SetMetadata } from '@nestjs/common';
export const Public = () => SetMetadata('isPublic', true);
