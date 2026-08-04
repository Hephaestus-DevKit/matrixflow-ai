import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus, Logger } from '@nestjs/common';
import { Request, Response } from 'express';
import { ZodError } from 'zod';
import { ErrorCode } from '@matrixflow/shared';

interface HttpExceptionLike {
  getResponse(): unknown;
  getStatus(): number;
}

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
      message =
        e.errors.map((err) => `${err.path.join('.')}: ${err.message}`).join(', ') ||
        'Validation failed';
      details = e.errors;
    } else if (this.isHttpException(e)) {
      const r = e.getResponse();
      status = e.getStatus();
      const body = r as { code?: unknown; message?: unknown; details?: unknown } | string;
      const rawMsg = typeof body === 'string' ? body : (body?.message ?? 'Error');
      message = Array.isArray(rawMsg) ? rawMsg.join(', ') : String(rawMsg);
      const knownCodes = new Set<string>(Object.values(ErrorCode));
      const explicitCode =
        typeof body === 'object' && typeof body.code === 'string' ? body.code : undefined;
      code = explicitCode ?? (knownCodes.has(message) ? message : this.codeForStatus(status));
      details =
        typeof body === 'object'
          ? (body.details ?? (Array.isArray(rawMsg) ? rawMsg : undefined))
          : undefined;
    } else if (e instanceof Error) {
      message = e.message;
    }

    if (status >= 500)
      this.log.error(
        `[${rid}] ${req.method} ${req.url} ${status} ${message}`,
        e instanceof Error ? e.stack : e,
      );
    else this.log.warn(`[${rid}] ${req.method} ${req.url} ${status} ${code}: ${message}`);

    res.status(status).json({ error: { code, message, details, requestId: rid } });
  }

  private codeForStatus(status: number): string {
    switch (status) {
      case HttpStatus.UNAUTHORIZED:
        return ErrorCode.UNAUTHORIZED;
      case HttpStatus.FORBIDDEN:
        return ErrorCode.FORBIDDEN;
      case HttpStatus.NOT_FOUND:
        return ErrorCode.NOT_FOUND;
      case HttpStatus.CONFLICT:
        return ErrorCode.CONFLICT;
      case HttpStatus.TOO_MANY_REQUESTS:
        return ErrorCode.RATE_LIMITED;
      case HttpStatus.PAYMENT_REQUIRED:
        return ErrorCode.PAYMENT_REQUIRED;
      default:
        return status >= 500 ? ErrorCode.INTERNAL : ErrorCode.BAD_REQUEST;
    }
  }

  private isHttpException(error: unknown): error is HttpExceptionLike {
    if (!error || typeof error !== 'object') return false;
    const candidate = error as Partial<HttpExceptionLike>;
    return typeof candidate.getResponse === 'function' && typeof candidate.getStatus === 'function';
  }
}
