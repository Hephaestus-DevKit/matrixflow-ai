import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { nanoid } from 'nanoid';

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const rid = (req.headers['x-request-id'] as string) ?? `mfa_req_${nanoid(16)}`;
    req.headers['x-request-id'] = rid;
    res.setHeader('x-request-id', rid);
    next();
  }
}
