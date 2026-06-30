import { Module } from '@nestjs/common';
import { CrmController } from './crm.controller';
import { CrmService } from './crm.service';
import { AiModule } from '../ai/ai.module';

@Module({ imports: [AiModule], controllers: [CrmController], providers: [CrmService], exports: [CrmService] })
export class CrmModule {}
