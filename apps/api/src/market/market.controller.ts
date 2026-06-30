import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import { Request } from 'express';
import { MarketService } from './market.service';
import { RequireAction, ReqUser } from '../common/interceptors/org.interceptor';
import { Public } from '../common/guards/jwt-auth.guard';

@Controller('market')
export class MarketController {
  constructor(private m: MarketService) {}

  @Public()
  @Get('items')
  list(@Query() q: any) { return this.m.list(q); }
  @Public()
  @Get('items/:id')
  get(@Param('id') id: string) { return this.m.get(id); }

  @Post('items')
  @RequireAction('content:write')
  publish(@Req() req: Request, @Body() body: any) { return this.m.publish((req.user as ReqUser).organizationId!, (req.user as ReqUser).id, body); }

  @Post('items/:id/purchase')
  @RequireAction('content:read')
  purchase(@Req() req: Request, @Param('id') id: string) { return this.m.purchase((req.user as ReqUser).organizationId!, (req.user as ReqUser).id, id); }

  @Get('purchased')
  @RequireAction('content:read')
  purchased(@Req() req: Request) { return this.m.purchased((req.user as ReqUser).organizationId!); }

  @Post('items/:id/reviews')
  @RequireAction('content:read')
  review(@Req() req: Request, @Param('id') id: string, @Body() body: { rating: number; comment?: string }) { return this.m.review((req.user as ReqUser).organizationId!, (req.user as ReqUser).id, id, body.rating, body.comment); }
}
