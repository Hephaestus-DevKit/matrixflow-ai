import { Module } from '@nestjs/common';
import { WorkflowController } from './workflow.controller';
import { WorkflowService } from './workflow.service';
import { WorkflowExecutor } from './workflow.executor';
import { AiModule } from '../ai/ai.module';
import { EMAIL_DELIVERY } from './ports/email-delivery';
import { DisabledEmailDelivery } from './adapters/disabled-email.delivery';

@Module({
  imports: [AiModule],
  controllers: [WorkflowController],
  providers: [
    WorkflowService,
    WorkflowExecutor,
    DisabledEmailDelivery,
    { provide: EMAIL_DELIVERY, useExisting: DisabledEmailDelivery },
  ],
  exports: [WorkflowService],
})
export class WorkflowModule {}
