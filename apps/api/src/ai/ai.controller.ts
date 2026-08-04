import { Body, Controller, Post, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { AiService } from './ai.service';
import { RequireAction, ReqUser } from '../common/auth-context';
import { Action, aiPromptRequestSchema } from '@matrixflow/shared';

@Controller('ai')
export class AiController {
  constructor(private ai: AiService) {}

  @Post('run')
  @RequireAction(Action.AGENT_RUN)
  run(@Req() req: Request, @Body() body: unknown) {
    const u = req.user as ReqUser;
    return this.ai.runPrompt({
      ...aiPromptRequestSchema.parse(body),
      organizationId: u.organizationId!,
      userId: u.id,
    });
  }

  @Post('stream')
  @RequireAction(Action.AGENT_RUN)
  async stream(@Req() req: Request, @Res() res: Response, @Body() body: unknown): Promise<void> {
    const u = req.user as ReqUser;
    const input = aiPromptRequestSchema.parse(body);
    const abortController = new AbortController();
    const abort = () => abortController.abort();
    res.on('close', abort);
    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();
    try {
      for await (const chunk of this.ai.stream(
        { ...input, organizationId: u.organizationId!, userId: u.id },
        abortController.signal,
      )) {
        if (res.destroyed) break;
        res.write(`event: ${chunk.done ? 'done' : 'delta'}\ndata: ${JSON.stringify(chunk)}\n\n`);
      }
    } catch (error) {
      if (!res.destroyed)
        res.write(
          `event: error\ndata: ${JSON.stringify({ message: (error as Error).message })}\n\n`,
        );
    } finally {
      res.off('close', abort);
      if (!res.destroyed) res.end();
    }
  }
}
