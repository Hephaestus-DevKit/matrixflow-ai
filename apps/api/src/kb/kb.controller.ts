import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { Request } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { KbService } from './kb.service';
import { RequireAction, ReqUser } from '../common/auth-context';
import { Action, createKnowledgeBaseSchema, ragQuerySchema } from '@matrixflow/shared';

@Controller('kb')
export class KbController {
  constructor(private kb: KbService) {}

  @Get()
  @RequireAction(Action.KB_READ)
  list(@Req() req: Request) {
    return this.kb.list((req.user as ReqUser).organizationId!);
  }

  @Post()
  @RequireAction(Action.KB_WRITE)
  create(@Req() req: Request, @Body() body: unknown) {
    return this.kb.create(
      (req.user as ReqUser).organizationId!,
      (req.user as ReqUser).id,
      createKnowledgeBaseSchema.parse(body),
    );
  }

  @Get(':id')
  @RequireAction(Action.KB_READ)
  get(@Req() req: Request, @Param('id') id: string) {
    return this.kb.get((req.user as ReqUser).organizationId!, id);
  }

  @Post(':id/documents')
  @RequireAction(Action.KB_WRITE)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: Number(process.env.UPLOAD_MAX_BYTES ?? 20_000_000) },
    }),
  )
  upload(@Req() req: Request, @Param('id') id: string, @UploadedFile() file: Express.Multer.File) {
    return this.kb.uploadDocument(
      (req.user as ReqUser).organizationId!,
      (req.user as ReqUser).id,
      id,
      file,
    );
  }

  @Post(':id/ask')
  @RequireAction(Action.KB_READ)
  ask(@Req() req: Request, @Param('id') id: string, @Body() body: unknown) {
    const { question } = ragQuerySchema.parse(body);
    return this.kb.ragQuery(
      (req.user as ReqUser).organizationId!,
      id,
      question,
      (req.user as ReqUser).id,
    );
  }

  @Delete('documents/:docId')
  @RequireAction(Action.KB_WRITE)
  deleteDoc(@Req() req: Request, @Param('docId') docId: string) {
    return this.kb.deleteDocument(
      (req.user as ReqUser).organizationId!,
      (req.user as ReqUser).id,
      docId,
    );
  }
}
