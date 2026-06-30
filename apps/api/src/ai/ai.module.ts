import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { AiGateway } from '@matrixflow/ai-gateway';

@Module({
  imports: [ConfigModule],
  controllers: [AiController],
  providers: [
    { provide: AiGateway, inject: [ConfigService], useFactory: (cfg: ConfigService) => new AiGateway({
      glm: { apiKey: cfg.get('GLM_API_KEY', ''), baseUrl: cfg.get('GLM_BASE_URL'), defaultModel: cfg.get('GLM_DEFAULT_MODEL') },
      openai: { apiKey: cfg.get('OPENAI_API_KEY', ''), baseUrl: cfg.get('OPENAI_BASE_URL'), defaultModel: cfg.get('OPENAI_DEFAULT_MODEL') },
    }) },
    AiService,
  ],
  exports: [AiService, AiGateway],
})
export class AiModule {}
