import { Body, Controller, Delete, Get, Param, Patch, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { OrgService } from './org.service';
import { RequireAction, ReqUser } from '../common/interceptors/org.interceptor';
import { Action } from '@matrixflow/shared';

@Controller('orgs')
export class OrgController {
  constructor(private org: OrgService) {}

  @Get()
  list(@Req() req: Request) { return this.org.list((req.user as ReqUser).id); }

  @Post()
  @RequireAction(Action.ORG_MANAGE)
  create(@Req() req: Request, @Body() body: unknown) { return this.org.create((req.user as ReqUser).id, body); }

  @Get(':orgId/members')
  @RequireAction(Action.ORG_MANAGE)
  members(@Param('orgId') orgId: string) { return this.org.members('', orgId); }

  @Post(':orgId/members')
  @RequireAction(Action.ORG_MANAGE)
  invite(@Req() req: Request, @Param('orgId') orgId: string, @Body() body: unknown) { return this.org.invite((req.user as ReqUser).id, orgId, body); }

  @Patch(':orgId/members/:userId')
  @RequireAction(Action.ORG_MANAGE)
  changeRole(@Req() req: Request, @Param('orgId') orgId: string, @Param('userId') userId: string, @Body() body: { roleName: string }) { return this.org.changeRole((req.user as ReqUser).id, orgId, userId, body.roleName); }

  @Delete(':orgId/members/:userId')
  @RequireAction(Action.ORG_MANAGE)
  remove(@Req() req: Request, @Param('orgId') orgId: string, @Param('userId') userId: string) { return this.org.remove((req.user as ReqUser).id, orgId, userId); }
}
