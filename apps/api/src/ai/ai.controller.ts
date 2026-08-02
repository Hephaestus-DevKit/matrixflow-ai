import { Body, Controller, Post, Req, Sse, MessageEvent } from '@nestjs/common';
import { Request } from 'express';
import { AiService } from './ai.service';
import { RequireAction, ReqUser } from '../common/auth-context';
import { Action } from '@matrixflow/shared';
import { Observable } from 'rxjs';

@Controller('ai')
export class AiController {
  constructor(private ai: AiService) {}

  @Post('run')
  @RequireAction(Action.AGENT_RUN)
  run(@Req() req: Request, @Body() body: { promptKey: string; variables: Record<string, unknown>; agentId?: string; responseFormat?: 'text' | 'json_object' }) {
    const u = req.user as ReqUser;
    return this.ai.runPrompt({ ...body, organizationId: u.organizationId!, userId: u.id });
  }

  @Sse('stream')
  @RequireAction(Action.AGENT_RUN)
  stream(@Req() req: Request, @Body() body: { promptKey: string; variables: Record<string, unknown>; agentId?: string }): Observable<MessageEvent> {
    const u = req.user as ReqUser;
    return new Observable<MessageEvent>((sub) => {
      (async () => {
        try {
          for await (const chunk of this.ai.stream({ ...body, organizationId: u.organizationId!, userId: u.id })) {
            sub.next({ type: 'delta', data: JSON.stringify(chunk) } as MessageEvent);
          }
          sub.complete();
        } catch (e) { sub.error(e); }
      })();
    });
  }
}
