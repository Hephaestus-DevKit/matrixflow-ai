import { Body, Controller, Delete, Get, Param, Patch, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { AgentService } from './agent.service';
import { RequireAction, ReqUser } from '../common/auth-context';
import { Action, cloneAgentSchema } from '@matrixflow/shared';

@Controller('agents')
export class AgentController {
  constructor(private agent: AgentService) {}

  @Get()
  @RequireAction(Action.AGENT_READ)
  list(@Req() req: Request) {
    return this.agent.list((req.user as ReqUser).organizationId!);
  }

  @Get(':id')
  @RequireAction(Action.AGENT_READ)
  get(@Req() req: Request, @Param('id') id: string) {
    return this.agent.get((req.user as ReqUser).organizationId!, id);
  }

  @Post()
  @RequireAction(Action.AGENT_WRITE)
  create(@Req() req: Request, @Body() body: unknown) {
    return this.agent.create((req.user as ReqUser).organizationId!, (req.user as ReqUser).id, body);
  }

  @Post('from-template/:templateId')
  @RequireAction(Action.AGENT_WRITE)
  fromTemplate(@Req() req: Request, @Param('templateId') tid: string, @Body() body: unknown) {
    const { name } = cloneAgentSchema.parse(body);
    return this.agent.createFromTemplate(
      (req.user as ReqUser).organizationId!,
      (req.user as ReqUser).id,
      tid,
      name,
    );
  }

  @Patch(':id')
  @RequireAction(Action.AGENT_WRITE)
  update(@Req() req: Request, @Param('id') id: string, @Body() body: unknown) {
    return this.agent.update(
      (req.user as ReqUser).organizationId!,
      (req.user as ReqUser).id,
      id,
      body,
    );
  }

  @Delete(':id')
  @RequireAction(Action.AGENT_WRITE)
  remove(@Req() req: Request, @Param('id') id: string) {
    return this.agent.remove((req.user as ReqUser).organizationId!, (req.user as ReqUser).id, id);
  }

  @Post(':id/run')
  @RequireAction(Action.AGENT_RUN)
  run(@Req() req: Request, @Param('id') id: string, @Body() body: unknown) {
    return this.agent.run(
      (req.user as ReqUser).organizationId!,
      (req.user as ReqUser).id,
      id,
      body,
    );
  }

  @Get(':id/logs')
  @RequireAction(Action.AGENT_READ)
  logs(@Req() req: Request, @Param('id') id: string) {
    return this.agent.logs((req.user as ReqUser).organizationId!, id);
  }
}
