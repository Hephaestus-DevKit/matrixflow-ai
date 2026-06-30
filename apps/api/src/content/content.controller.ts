import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import { Request } from 'express';
import { ContentService } from './content.service';
import { RequireAction, ReqUser } from '../common/interceptors/org.interceptor';
import { Action } from '@matrixflow/shared';

@Controller('content')
export class ContentController {
  constructor(private content: ContentService) {}

  @Post('projects')
  @RequireAction(Action.CONTENT_WRITE)
  createProject(@Req() req: Request, @Body() body: { name: string; productData: unknown; brandVoiceId?: string }) {
    return this.content.createProject((req.user as ReqUser).organizationId!, (req.user as ReqUser).id, body);
  }

  @Get('projects')
  @RequireAction(Action.CONTENT_READ)
  listProjects(@Req() req: Request) { return this.content.listProjects((req.user as ReqUser).organizationId!); }

  @Get('projects/:id')
  @RequireAction(Action.CONTENT_READ)
  getProject(@Req() req: Request, @Param('id') id: string) { return this.content.getProject((req.user as ReqUser).organizationId!, id); }

  @Post('projects/:id/generate')
  @RequireAction(Action.CONTENT_WRITE)
  generate(@Req() req: Request, @Param('id') id: string, @Body() body: { type: string; variables?: Record<string, unknown> }) {
    return this.content.generate((req.user as ReqUser).organizationId!, (req.user as ReqUser).id, id, body.type, body.variables ?? {});
  }

  @Post('projects/:id/generate-all')
  @RequireAction(Action.CONTENT_WRITE)
  generateAll(@Req() req: Request, @Param('id') id: string, @Body() body: { language?: string }) {
    return this.content.generateAll((req.user as ReqUser).organizationId!, (req.user as ReqUser).id, id, body.language ?? 'en');
  }

  @Get('projects/:id/items')
  @RequireAction(Action.CONTENT_READ)
  listItems(@Req() req: Request, @Param('id') id: string, @Query('type') type?: string) {
    return this.content.listItems((req.user as ReqUser).organizationId!, id, type);
  }

  @Post('items/:itemId/versions')
  @RequireAction(Action.CONTENT_WRITE)
  saveVersion(@Req() req: Request, @Param('itemId') itemId: string, @Body() body: { content: string; changeNote?: string }) {
    return this.content.saveVersion((req.user as ReqUser).organizationId!, itemId, body, (req.user as ReqUser).id);
  }

  @Post('items/:itemId/score')
  @RequireAction(Action.CONTENT_READ)
  score(@Req() req: Request, @Param('itemId') itemId: string, @Body() body: { dimension: string }) {
    return this.content.score((req.user as ReqUser).organizationId!, itemId, body.dimension);
  }
}
