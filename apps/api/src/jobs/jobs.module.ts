import { Module } from '@nestjs/common';
import { KbModule } from '../kb/kb.module';
import { WorkflowModule } from '../workflow/workflow.module';
import { InternalJobGuard } from './internal-job.guard';
import { InternalJobsController } from './internal-jobs.controller';

@Module({
  imports: [KbModule, WorkflowModule],
  controllers: [InternalJobsController],
  providers: [InternalJobGuard],
})
export class JobsModule {}
