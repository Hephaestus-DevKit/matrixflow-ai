import { Module, Controller, Get } from '@nestjs/common';
import { Public } from '../common/guards/jwt-auth.guard';

@Controller('health')
export class HealthController {
  @Public()
  @Get()
  check() { return { status: 'ok', ts: new Date().toISOString(), uptime: process.uptime() }; }
  @Public()
  @Get('live')
  liveness() { return { status: 'alive' }; }
  @Public()
  @Get('ready')
  readiness() { return { status: 'ready' }; }
}

@Module({ controllers: [HealthController] })
export class HealthModule {}
