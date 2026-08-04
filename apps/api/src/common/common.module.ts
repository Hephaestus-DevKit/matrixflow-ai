import { Global, Module } from '@nestjs/common';
import { AuditService } from './audit.service';
import { MetricsController } from './metrics.controller';
import { MetricsGuard } from './metrics.guard';
import { MetricsService } from './metrics.service';

@Global()
@Module({
  controllers: [MetricsController],
  providers: [AuditService, MetricsGuard, MetricsService],
  exports: [AuditService, MetricsService],
})
export class CommonModule {}
