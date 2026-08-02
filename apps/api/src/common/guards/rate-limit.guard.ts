import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { createHash } from 'crypto';
import { RedisService } from '../../redis/redis.service';

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(private readonly redis: RedisService, private readonly config: ConfigService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const max = Math.max(1, this.config.get<number>('API_RATE_LIMIT_MAX', 120));
    const windowSeconds = Math.max(1, this.config.get<number>('API_RATE_LIMIT_WINDOW_SECONDS', 60));
    const identity = request.user?.id ?? request.ip ?? request.socket.remoteAddress ?? 'unknown';
    const key = createHash('sha256').update(identity).digest('hex').slice(0, 32);

    try {
      const count = await this.redis.incr(`rate:api:${key}`, windowSeconds);
      response.setHeader('RateLimit-Limit', max);
      response.setHeader('RateLimit-Remaining', Math.max(0, max - count));
      response.setHeader('RateLimit-Reset', windowSeconds);
      if (count > max) throw new HttpException('RATE_LIMITED', HttpStatus.TOO_MANY_REQUESTS);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      // Availability is preferable to a total outage when Redis is degraded.
    }
    return true;
  }
}
