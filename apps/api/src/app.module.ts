import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { APP_INTERCEPTOR, APP_FILTER, APP_GUARD } from '@nestjs/core';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { AuthModule } from './auth/auth.module';
import { OrgModule } from './org/org.module';
import { AiModule } from './ai/ai.module';
import { AgentModule } from './agent/agent.module';
import { ContentModule } from './content/content.module';
import { HealthModule } from './health/health.module';
import { CommonModule } from './common/common.module';
import { FileModule } from './file/file.module';
import { KbModule } from './kb/kb.module';
import { WorkflowModule } from './workflow/workflow.module';
import { CrmModule } from './crm/crm.module';
import { MarketModule } from './market/market.module';
import { BillingModule } from './billing/billing.module';
import { AdminModule } from './admin/admin.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { MetricsInterceptor } from './common/interceptors/metrics.interceptor';
import { RateLimitGuard } from './common/guards/rate-limit.guard';
import { QueueModule } from './queue/queue.module';
import { JobsModule } from './jobs/jobs.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env.local', '.env', '../../.env.local', '../../.env'] }),
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        pinoHttp: {
          level: cfg.get('LOG_LEVEL', 'info'),
          transport: cfg.get('NODE_ENV') === 'development' ? { target: 'pino-pretty' } : undefined,
          genReqId: (req) => (req.headers['x-request-id'] as string) ?? crypto.randomUUID(),
        },
      }),
    }),
    CommonModule, PrismaModule, RedisModule, QueueModule, FileModule, HealthModule,
    AuthModule, OrgModule, AiModule, AgentModule, ContentModule, KbModule, WorkflowModule, CrmModule, MarketModule, BillingModule, AdminModule,
    JobsModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: MetricsInterceptor },
    { provide: APP_GUARD, useClass: RateLimitGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
