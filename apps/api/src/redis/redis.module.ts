import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RedisService } from './redis.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: RedisService,
      useFactory: (cfg: ConfigService) =>
        new RedisService(
          cfg.get<string>('REDIS_URL', 'redis://localhost:6379/0'),
          cfg.get('REDIS_PREFIX', 'mfa:'),
        ),
      inject: [ConfigService],
    },
  ],
  exports: [RedisService],
})
export class RedisModule {}
