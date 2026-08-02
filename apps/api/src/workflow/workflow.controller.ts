import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { WorkflowService } from './workflow.service';
import { RequireAction, ReqUser } from '../common/auth-context';
import { Action } from '@matrixflow/shared';

@Controller('workflows')
export class WorkflowController {
  constructor(private wf: WorkflowService) {}

  @Get()
  @RequireAction(Action.WORKFLOW_READ)
  list(@Req() req: Request) { return this.wf.list((req.user as ReqUser).organizationId!); }

  @Get(':id')
  @RequireAction(Action.WORKFLOW_READ)
  get(@Req() req: Request, @Param('id') id: string) { return this.wf.get((req.user as ReqUser).organizationId!, id); }

  @Post()
  @RequireAction(Action.WORKFLOW_WRITE)
  create(@Req() req: Request, @Body() body: { name: string; description?: string; dsl: any }) { return this.wf.create((req.user as ReqUser).organizationId!, (req.user as ReqUser).id, body); }

  @Post(':id/versions')
  @RequireAction(Action.WORKFLOW_WRITE)
  saveVersion(@Req() req: Request, @Param('id') id: string, @Body() body: { dsl: any; changeNote?: string }) { return this.wf.saveVersion((req.user as ReqUser).organizationId!, (req.user as ReqUser).id, id, body.dsl, body.changeNote); }

  @Post(':id/run')
  @RequireAction(Action.WORKFLOW_RUN)
  run(@Req() req: Request, @Param('id') id: string, @Body() body: { input?: any }) { return this.wf.run((req.user as ReqUser).organizationId!, (req.user as ReqUser).id, id, body.input); }

  @Get(':id/logs')
  @RequireAction(Action.WORKFLOW_READ)
  logs(@Req() req: Request, @Param('id') id: string) { return this.wf.logs((req.user as ReqUser).organizationId!, id); }

  @Get(':id/export')
  @RequireAction(Action.WORKFLOW_READ)
  export(@Req() req: Request, @Param('id') id: string) { return this.wf.exportTemplate((req.user as ReqUser).organizationId!, id); }
}
