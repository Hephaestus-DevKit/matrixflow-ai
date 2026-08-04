import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import { Request } from 'express';
import { MarketService } from './market.service';
import { RequireAction, ReqUser } from '../common/auth-context';
import { Public } from '../common/guards/jwt-auth.guard';
import { Action } from '@matrixflow/shared';

@Controller('market')
export class MarketController {
  constructor(private m: MarketService) {}

  @Public()
  @Get('items')
  list(@Query() q: unknown) {
    return this.m.list(q);
  }
  @Public()
  @Get('items/:id')
  get(@Param('id') id: string) {
    return this.m.get(id);
  }

  @Post('items')
  @RequireAction(Action.MARKET_WRITE)
  publish(@Req() req: Request, @Body() body: unknown) {
    return this.m.publish((req.user as ReqUser).organizationId!, (req.user as ReqUser).id, body);
  }

  @Post('items/:id/purchase')
  @RequireAction(Action.MARKET_PURCHASE)
  purchase(@Req() req: Request, @Param('id') id: string) {
    return this.m.purchase((req.user as ReqUser).organizationId!, (req.user as ReqUser).id, id);
  }

  @Get('purchased')
  @RequireAction(Action.MARKET_READ)
  purchased(@Req() req: Request) {
    return this.m.purchased((req.user as ReqUser).organizationId!);
  }

  @Post('items/:id/reviews')
  @RequireAction(Action.MARKET_PURCHASE)
  review(@Req() req: Request, @Param('id') id: string, @Body() body: unknown) {
    return this.m.review((req.user as ReqUser).organizationId!, (req.user as ReqUser).id, id, body);
  }
}
