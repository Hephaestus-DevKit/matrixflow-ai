import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus, Logger } from '@nestjs/common';
import { Request, Response } from 'express';
import { ZodError } from 'zod';
import { ErrorCode } from '@matrixflow/shared';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly log = new Logger(HttpExceptionFilter.name);
  catch(e: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();
    const rid = (req.headers['x-request-id'] as string) ?? '-';

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code: string = ErrorCode.INTERNAL;
    let message = 'Internal server error';
    let details: unknown;

    if (e instanceof ZodError) { 
      status = 400; 
      code = ErrorCode.BAD_REQUEST; 
      message = e.errors.map((err) => `${err.path.join('.')}: ${err.message}`).join(', ') || 'Validation failed'; 
      details = e.errors; 
    } else if (e && typeof e === 'object' && 'getResponse' in e && 'getStatus' in e) {
      const r = (e as any).getResponse();
      status = (e as any).getStatus();
      const body = r;
      code = body?.code ?? (typeof body === 'string' ? body : ErrorCode.BAD_REQUEST);
      const rawMsg = body?.message ?? (typeof body === 'string' ? body : 'Error');
      message = Array.isArray(rawMsg) ? rawMsg.join(', ') : String(rawMsg);
      details = body?.details ?? (Array.isArray(rawMsg) ? rawMsg : undefined);
    } else if (e instanceof Error) { 
      message = e.message; 
    }

    if (status >= 500) this.log.error(`[${rid}] ${req.method} ${req.url} ${status} ${message}`, e instanceof Error ? e.stack : e);
    else this.log.warn(`[${rid}] ${req.method} ${req.url} ${status} ${code}: ${message}`);

    res.status(status).json({ error: { code, message, details, requestId: rid } });
  }
}
