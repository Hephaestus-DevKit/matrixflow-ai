import { Module } from '@nestjs/common';
import { WorkflowController } from './workflow.controller';
import { WorkflowService } from './workflow.service';
import { WorkflowExecutor } from './executor';

@Module({ controllers: [WorkflowController], providers: [WorkflowService, WorkflowExecutor], exports: [WorkflowService] })
export class WorkflowModule {}
