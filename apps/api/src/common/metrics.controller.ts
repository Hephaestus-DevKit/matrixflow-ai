import { Controller, Get, Header, UseGuards } from '@nestjs/common';
import { Public } from './guards/jwt-auth.guard';
import { MetricsGuard } from './metrics.guard';
import { MetricsService } from './metrics.service';

@Controller('metrics')
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  @Public()
  @UseGuards(MetricsGuard)
  @Get()
  @Header('Cache-Control', 'no-store')
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  async getMetrics() {
    return this.metrics.render();
  }
}
