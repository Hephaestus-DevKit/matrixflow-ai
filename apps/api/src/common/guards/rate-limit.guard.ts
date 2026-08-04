import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { Request, Response } from 'express';
import { createHash } from 'crypto';
import { RedisService } from '../../redis/redis.service';

const RATE_LIMIT_KEY = 'rate-limit-policy';
interface RateLimitPolicy {
  name: string;
  max: number;
  windowSeconds: number;
  failClosed?: boolean;
}
export const RateLimit = (policy: RateLimitPolicy) => SetMetadata(RATE_LIMIT_KEY, policy);

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly redis: RedisService,
    private readonly config: ConfigService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const policy = this.reflector.getAllAndOverride<RateLimitPolicy>(RATE_LIMIT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const max = Math.max(1, policy?.max ?? this.config.get<number>('API_RATE_LIMIT_MAX', 120));
    const windowSeconds = Math.max(
      1,
      policy?.windowSeconds ?? this.config.get<number>('API_RATE_LIMIT_WINDOW_SECONDS', 60),
    );
    const identity = request.user?.id
      ? `user:${request.user.id}`
      : `ip:${request.ip ?? request.socket.remoteAddress ?? 'unknown'}`;
    const key = createHash('sha256').update(identity).digest('hex').slice(0, 32);

    try {
      const count = await this.redis.incr(`rate:${policy?.name ?? 'api'}:${key}`, windowSeconds);
      response.setHeader('RateLimit-Limit', max);
      response.setHeader('RateLimit-Remaining', Math.max(0, max - count));
      response.setHeader('RateLimit-Reset', windowSeconds);
      if (count > max) throw new HttpException('RATE_LIMITED', HttpStatus.TOO_MANY_REQUESTS);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      if (policy?.failClosed)
        throw new HttpException('Rate limit service unavailable', HttpStatus.SERVICE_UNAVAILABLE);
    }
    return true;
  }
}
