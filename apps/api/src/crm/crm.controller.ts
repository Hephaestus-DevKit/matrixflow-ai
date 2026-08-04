import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import { Request } from 'express';
import { CrmService } from './crm.service';
import { RequireAction, ReqUser } from '../common/auth-context';
import { Action } from '@matrixflow/shared';

@Controller('crm')
export class CrmController {
  constructor(private crm: CrmService) {}

  @Get('customers')
  @RequireAction(Action.CRM_READ)
  list(@Req() req: Request, @Query('q') q?: string) {
    return this.crm.listCustomers((req.user as ReqUser).organizationId!, q);
  }
  @Get('customers/:id')
  @RequireAction(Action.CRM_READ)
  get(@Req() req: Request, @Param('id') id: string) {
    return this.crm.getCustomer((req.user as ReqUser).organizationId!, id);
  }
  @Post('customers')
  @RequireAction(Action.CRM_WRITE)
  create(@Req() req: Request, @Body() body: unknown) {
    return this.crm.createCustomer((req.user as ReqUser).organizationId!, body);
  }

  @Get('leads')
  @RequireAction(Action.CRM_READ)
  leads(@Req() req: Request) {
    return this.crm.listLeads((req.user as ReqUser).organizationId!);
  }
  @Post('leads')
  @RequireAction(Action.CRM_WRITE)
  createLead(@Req() req: Request, @Body() body: unknown) {
    return this.crm.createLead((req.user as ReqUser).organizationId!, body);
  }

  @Get('conversations')
  @RequireAction(Action.CRM_READ)
  convs(@Req() req: Request) {
    return this.crm.conversations((req.user as ReqUser).organizationId!);
  }
  @Get('conversations/:id')
  @RequireAction(Action.CRM_READ)
  conv(@Req() req: Request, @Param('id') id: string) {
    return this.crm.conversation((req.user as ReqUser).organizationId!, id);
  }
  @Post('conversations/:id/messages')
  @RequireAction(Action.CRM_WRITE)
  send(@Req() req: Request, @Param('id') id: string, @Body() body: unknown) {
    return this.crm.sendMessage((req.user as ReqUser).organizationId!, id, body);
  }
  @Post('conversations/:id/ai-reply')
  @RequireAction(Action.CRM_WRITE)
  aiReply(@Req() req: Request, @Param('id') id: string) {
    return this.crm.aiReply((req.user as ReqUser).organizationId!, id, (req.user as ReqUser).id);
  }
  @Post('conversations/:id/summarize')
  @RequireAction(Action.CRM_WRITE)
  summarize(@Req() req: Request, @Param('id') id: string) {
    return this.crm.summarize((req.user as ReqUser).organizationId!, id, (req.user as ReqUser).id);
  }

  @Get('follow-ups')
  @RequireAction(Action.CRM_READ)
  followUps(@Req() req: Request) {
    return this.crm.followUps((req.user as ReqUser).organizationId!);
  }
}
