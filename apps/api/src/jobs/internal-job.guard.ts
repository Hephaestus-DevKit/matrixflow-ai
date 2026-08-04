import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'crypto';
import { Request } from 'express';

@Injectable()
export class InternalJobGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const configured = this.config.get<string>('INTERNAL_JOB_SECRET', '');
    const supplied =
      context.switchToHttp().getRequest<Request>().header('x-internal-job-secret') ?? '';
    const expectedBuffer = Buffer.from(configured);
    const suppliedBuffer = Buffer.from(supplied);
    if (
      !configured ||
      expectedBuffer.length !== suppliedBuffer.length ||
      !timingSafeEqual(expectedBuffer, suppliedBuffer)
    ) {
      throw new ForbiddenException();
    }
    return true;
  }
}
