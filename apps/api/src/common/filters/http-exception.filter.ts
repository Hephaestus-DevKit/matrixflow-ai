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

    if (e instanceof ZodError) { status = 400; code = ErrorCode.BAD_REQUEST; message = 'Validation failed'; details = e.errors; }
    else if (e && typeof e === 'object' && 'getResponse' in e && 'getStatus' in e) {
      const r = (e as any).getResponse();
      status = (e as any).getStatus();
      const body = typeof r === 'string' ? r : r;
      code = body?.code ?? (typeof body === 'string' ? body : ErrorCode.BAD_REQUEST);
      message = body?.message ?? (typeof body === 'string' ? body : 'Error');
      details = body?.details;
    } else if (e instanceof Error) { message = e.message; }

    if (status >= 500) this.log.error(`[${rid}] ${req.method} ${req.url} ${status} ${message}`, e instanceof Error ? e.stack : e);
    else this.log.warn(`[${rid}] ${req.method} ${req.url} ${status} ${code}: ${message}`);

    res.status(status).json({ error: { code, message, details, requestId: rid } });
  }
}
