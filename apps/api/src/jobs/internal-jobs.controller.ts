import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { Public } from '../common/guards/jwt-auth.guard';
import { KbService } from '../kb/kb.service';
import { WorkflowService } from '../workflow/workflow.service';
import { InternalJobGuard } from './internal-job.guard';
import { executeWorkflowJobSchema } from '@matrixflow/shared';

@Public()
@UseGuards(InternalJobGuard)
@Controller('internal/jobs')
export class InternalJobsController {
  constructor(
    private readonly kb: KbService,
    private readonly workflows: WorkflowService,
  ) {}

  @Post('documents/:docId/process')
  async processDocument(@Param('docId') docId: string) {
    await this.kb.processDocument(docId);
    return { ok: true };
  }

  @Post('workflows/:runId/execute')
  executeWorkflow(@Param('runId') runId: string, @Body() body: unknown) {
    return this.workflows.processRun(runId, executeWorkflowJobSchema.parse(body).userId);
  }
}
