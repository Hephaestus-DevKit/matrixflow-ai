import { Body, Controller, Get, Post, Query, Req } from '@nestjs/common';
import { Request } from 'express';
import { BillingService } from './billing.service';
import { Public } from '../common/guards/jwt-auth.guard';
import { RequireAction, ReqUser } from '../common/auth-context';
import { Action } from '@matrixflow/shared';

@Controller('billing')
export class BillingController {
  constructor(private b: BillingService) {}

  @Public()
  @Get('plans')
  plans() { return this.b.plans(); }

  @Get('current')
  current(@Req() req: Request) { return this.b.current((req.user as ReqUser).organizationId!); }

  @Post('subscribe')
  @RequireAction(Action.BILLING_MANAGE)
  subscribe(@Req() req: Request, @Body() body: { planId: string; interval?: 'month' | 'year' }) { return this.b.subscribe((req.user as ReqUser).organizationId!, body.planId, body.interval); }

  @Get('usage')
  usage(@Req() req: Request, @Query('metric') metric?: string) { return this.b.usage((req.user as ReqUser).organizationId!, metric); }

  @Get('invoices')
  invoices(@Req() req: Request) { return this.b.invoices((req.user as ReqUser).organizationId!); }

  @Get('tokens')
  tokens(@Req() req: Request) { return this.b.tokenUsage((req.user as ReqUser).organizationId!); }
}
