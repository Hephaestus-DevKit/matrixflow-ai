import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Public } from '../common/guards/jwt-auth.guard';
import { isFeatureRequired } from '../config/runtime-security';
import { FileService } from '../file/file.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly files: FileService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @Get()
  check() {
    return { status: 'ok', ts: new Date().toISOString(), uptime: process.uptime() };
  }

  @Public()
  @Get('live')
  liveness() {
    return { status: 'alive' };
  }

  @Public()
  @Get('ready')
  async readiness() {
    const checks = await Promise.allSettled([
      this.prisma.$queryRaw`SELECT 1`,
      this.redis.ping(),
      this.files.health(),
    ]);
    const components = {
      database: checks[0].status === 'fulfilled' ? 'up' : 'down',
      redis: checks[1].status === 'fulfilled' && checks[1].value === 'PONG' ? 'up' : 'down',
      objectStorage: checks[2].status === 'fulfilled' && checks[2].value ? 'up' : 'down',
    };
    const criticalUnavailable =
      components.database === 'down' ||
      components.redis === 'down' ||
      (components.objectStorage === 'down' &&
        isFeatureRequired(this.config.get<string>('OBJECT_STORAGE_REQUIRED')));
    if (criticalUnavailable) {
      throw new ServiceUnavailableException({ status: 'not_ready', components });
    }
    return {
      status: components.objectStorage === 'down' ? 'degraded' : 'ready',
      components,
    };
  }
}
