import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { ErrorCode } from '@matrixflow/shared';
import { PERMS_KEY, ReqUser } from '../auth-context';
import { AuthService } from '../../auth/auth.service';
import { ConfigService } from '@nestjs/config';
import { Client, Account } from 'node-appwrite';
import { RedisService } from '../../redis/redis.service';
import * as crypto from 'crypto';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly logger = new Logger(JwtAuthGuard.name);
  constructor(
    private reflector: Reflector,
    private authService: AuthService,
    private cfg: ConfigService,
    private redis: RedisService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>('isPublic', [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (isPublic) return true;
    const req = ctx.switchToHttp().getRequest<Request>();
    const token = this.extract(req);
    if (!token) throw new UnauthorizedException(ErrorCode.UNAUTHORIZED);

    const headerOrg = req.header('x-organization-id')?.trim() || undefined;
    let userContext: ReqUser | null = null;
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const cacheKey = `jwt:${tokenHash}:${headerOrg || 'default'}`;

    try {
      const cached = await this.redis.get<unknown>(cacheKey);
      userContext = this.toUserContext(cached);
      if (cached && !userContext) await this.redis.del(cacheKey).catch(() => undefined);
    } catch (cacheErr) {
      this.logger.warn(`JWT cache read failed: ${this.errorMessage(cacheErr)}`);
    }

    if (!userContext) {
      try {
        const authMode = this.cfg.get<string>('AUTH_MODE', 'appwrite');
        if (authMode === 'local' || this.cfg.get('NODE_ENV') === 'test') {
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
          const projectId = this.cfg.get<string>('APPWRITE_PROJECT_ID', '');
          if (!projectId) throw new Error('APPWRITE_PROJECT_ID is required');
          const client = new Client()
            .setEndpoint(this.cfg.get<string>('APPWRITE_ENDPOINT', 'https://cloud.appwrite.io/v1'))
            .setProject(projectId);

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
          this.logger.warn(`JWT cache write failed: ${this.errorMessage(cacheErr)}`);
        }
      } catch (err) {
        this.logger.warn(`Token verification failed: ${this.errorMessage(err)}`);
        throw new UnauthorizedException(ErrorCode.TOKEN_INVALID);
      }
    }

    if (!userContext) throw new UnauthorizedException(ErrorCode.TOKEN_INVALID);
    req.user = userContext;

    const required = this.reflector.getAllAndOverride<string[]>(PERMS_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (required?.length && !required.some((p) => req.user?.permissions?.includes(p))) {
      throw new ForbiddenException(ErrorCode.FORBIDDEN);
    }
    return true;
  }

  private extract(req: Request): string | undefined {
    const h = req.headers.authorization;
    if (h?.startsWith('Bearer ')) return h.slice(7);
    return undefined;
  }

  private toUserContext(value: unknown): ReqUser | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const candidate = value as Record<string, unknown>;
    if (
      typeof candidate.id !== 'string' ||
      typeof candidate.email !== 'string' ||
      typeof candidate.name !== 'string' ||
      (candidate.organizationId !== undefined && typeof candidate.organizationId !== 'string') ||
      (candidate.role !== undefined && typeof candidate.role !== 'string') ||
      !Array.isArray(candidate.permissions) ||
      candidate.permissions.some((permission) => typeof permission !== 'string')
    ) {
      return null;
    }
    return {
      id: candidate.id,
      email: candidate.email,
      name: candidate.name,
      organizationId: candidate.organizationId as string | undefined,
      role: candidate.role as string | undefined,
      permissions: candidate.permissions as string[],
    };
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}

import { SetMetadata } from '@nestjs/common';
export const Public = () => SetMetadata('isPublic', true);
