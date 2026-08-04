import { Module } from '@nestjs/common';
import { WorkflowController } from './workflow.controller';
import { WorkflowService } from './workflow.service';
import { WorkflowExecutor } from './workflow.executor';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [AiModule],
  controllers: [WorkflowController],
  providers: [WorkflowService, WorkflowExecutor],
  exports: [WorkflowService],
})
export class WorkflowModule {}
