import { Module } from '@nestjs/common';
import { AgentController } from './agent.controller';
import { AgentService } from './agent.service';
import { AiModule } from '../ai/ai.module';

@Module({ imports: [AiModule], controllers: [AgentController], providers: [AgentService], exports: [AgentService] })
export class AgentModule {}
