import { Body, Controller, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { Request } from 'express';
import { CrmService } from './crm.service';
import { RequireAction, ReqUser } from '../common/interceptors/org.interceptor';
import { Action } from '@matrixflow/shared';

@Controller('crm')
export class CrmController {
  constructor(private crm: CrmService) {}

  @Get('customers')
  @RequireAction(Action.CRM_READ)
  list(@Req() req: Request, @Query('q') q?: string) { return this.crm.listCustomers((req.user as ReqUser).organizationId!, q); }
  @Get('customers/:id')
  @RequireAction(Action.CRM_READ)
  get(@Req() req: Request, @Param('id') id: string) { return this.crm.getCustomer((req.user as ReqUser).organizationId!, id); }
  @Post('customers')
  @RequireAction(Action.CRM_WRITE)
  create(@Req() req: Request, @Body() body: any) { return this.crm.createCustomer((req.user as ReqUser).organizationId!, body); }

  @Get('leads')
  @RequireAction(Action.CRM_READ)
  leads(@Req() req: Request) { return this.crm.listLeads((req.user as ReqUser).organizationId!); }
  @Post('leads')
  @RequireAction(Action.CRM_WRITE)
  createLead(@Req() req: Request, @Body() body: { customerId: string; source?: string; score?: number }) { return this.crm.createLead((req.user as ReqUser).organizationId!, body.customerId, { source: body.source, score: body.score }); }

  @Get('conversations')
  @RequireAction(Action.CRM_READ)
  convs(@Req() req: Request) { return this.crm.conversations((req.user as ReqUser).organizationId!); }
  @Get('conversations/:id')
  @RequireAction(Action.CRM_READ)
  conv(@Req() req: Request, @Param('id') id: string) { return this.crm.conversation((req.user as ReqUser).organizationId!, id); }
  @Post('conversations/:id/messages')
  @RequireAction(Action.CRM_WRITE)
  send(@Req() req: Request, @Param('id') id: string, @Body() body: { role: string; content: string }) { return this.crm.sendMessage((req.user as ReqUser).organizationId!, id, body.role, body.content); }
  @Post('conversations/:id/ai-reply')
  @RequireAction(Action.CRM_WRITE)
  aiReply(@Req() req: Request, @Param('id') id: string) { return this.crm.aiReply((req.user as ReqUser).organizationId!, id, (req.user as ReqUser).id); }
  @Post('conversations/:id/summarize')
  @RequireAction(Action.CRM_WRITE)
  summarize(@Req() req: Request, @Param('id') id: string) { return this.crm.summarize((req.user as ReqUser).organizationId!, id, (req.user as ReqUser).id); }

  @Get('follow-ups')
  @RequireAction(Action.CRM_READ)
  followUps(@Req() req: Request) { return this.crm.followUps((req.user as ReqUser).organizationId!); }
}
