import { Body, Controller, Delete, ForbiddenException, Get, Param, Patch, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { OrgService } from './org.service';
import { RequireAction, ReqUser } from '../common/auth-context';
import { Action } from '@matrixflow/shared';

@Controller('orgs')
export class OrgController {
  constructor(private org: OrgService) {}

  private currentUserForOrg(req: Request, orgId: string): ReqUser {
    const user = req.user as ReqUser;
    if (!user.organizationId || user.organizationId !== orgId) {
      throw new ForbiddenException('Organization does not match the authenticated context');
    }
    return user;
  }

  @Get()
  list(@Req() req: Request) { return this.org.list((req.user as ReqUser).id); }

  @Post()
  @RequireAction(Action.ORG_MANAGE)
  create(@Req() req: Request, @Body() body: unknown) { return this.org.create((req.user as ReqUser).id, body); }

  @Get(':orgId/members')
  @RequireAction(Action.ORG_MANAGE)
  members(@Req() req: Request, @Param('orgId') orgId: string) {
    const user = this.currentUserForOrg(req, orgId);
    return this.org.members(user.id, orgId);
  }

  @Post(':orgId/members')
  @RequireAction(Action.ORG_MANAGE)
  invite(@Req() req: Request, @Param('orgId') orgId: string, @Body() body: unknown) {
    const user = this.currentUserForOrg(req, orgId);
    return this.org.invite(user.id, orgId, body);
  }

  @Patch(':orgId/members/:userId')
  @RequireAction(Action.ORG_MANAGE)
  changeRole(@Req() req: Request, @Param('orgId') orgId: string, @Param('userId') userId: string, @Body() body: { roleName: string }) {
    const user = this.currentUserForOrg(req, orgId);
    return this.org.changeRole(user.id, orgId, userId, body.roleName);
  }

  @Delete(':orgId/members/:userId')
  @RequireAction(Action.ORG_MANAGE)
  remove(@Req() req: Request, @Param('orgId') orgId: string, @Param('userId') userId: string) {
    const user = this.currentUserForOrg(req, orgId);
    return this.org.remove(user.id, orgId, userId);
  }
}
