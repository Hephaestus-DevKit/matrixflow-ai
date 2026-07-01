import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { ErrorCode } from '@matrixflow/shared';
import { PERMS_KEY } from '../interceptors/org.interceptor';
import { AuthService } from '../../auth/auth.service';
import { ConfigService } from '@nestjs/config';
import { Client, Account } from 'node-appwrite';
import { RedisService } from '../../redis/redis.service';
import * as crypto from 'crypto';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private authService: AuthService,
    private cfg: ConfigService,
    private redis: RedisService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>('isPublic', [ctx.getHandler(), ctx.getClass()]);
    if (isPublic) return true;
    const req = ctx.switchToHttp().getRequest<Request>();
    const token = this.extract(req);
    if (!token) throw new UnauthorizedException(ErrorCode.UNAUTHORIZED);

    const headerOrg = req.headers['x-organization-id'] as string | undefined;
    let userContext: any = null;
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const cacheKey = `jwt:${tokenHash}:${headerOrg || 'default'}`;

    try {
      userContext = await this.redis.get<any>(cacheKey);
    } catch (cacheErr) {
      console.warn('JWT cache read error:', cacheErr);
    }

    if (!userContext) {
      try {
        if (this.cfg.get('NODE_ENV') === 'test') {
          const payload = this.authService.verifyToken(token);
          userContext = {
            id: payload.sub,
            email: payload.email,
            name: payload.name,
            organizationId: payload.oid,
            role: payload.role,
            permissions: payload.perms ?? [],
          };
        } else {
          // Initialize Appwrite Client with the user's JWT
          const client = new Client()
            .setEndpoint(this.cfg.get<string>('APPWRITE_ENDPOINT', 'https://cloud.appwrite.io/v1'))
            .setProject(this.cfg.get<string>('APPWRITE_PROJECT_ID', ''));
          
          client.setJWT(token);

          const appwriteAccount = new Account(client);
          const appwriteUser = await appwriteAccount.get();
          
          // Auto-sync / verify user context in our PostgreSQL database (enforcing target org permissions)
          const syncedUser = await this.authService.syncUser(appwriteUser, headerOrg);
          
          userContext = {
            id: syncedUser.id,
            email: syncedUser.email,
            name: syncedUser.name,
            organizationId: syncedUser.organizationId,
            role: syncedUser.role,
            permissions: syncedUser.permissions ?? [],
          };
        }

        try {
          await this.redis.set(cacheKey, userContext, 60);
        } catch (cacheErr) {
          console.warn('JWT cache write error:', cacheErr);
        }
      } catch (err) {
        console.error('Appwrite verification error:', err);
        throw new UnauthorizedException(ErrorCode.TOKEN_INVALID);
      }
    }

    req.user = userContext;

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
