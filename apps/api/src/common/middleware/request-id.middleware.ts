import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { nanoid } from 'nanoid';

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const supplied = req.headers['x-request-id'];
    const rid =
      typeof supplied === 'string' && /^[A-Za-z0-9._:-]{1,128}$/.test(supplied)
        ? supplied
        : `mfa_req_${nanoid(16)}`;
    req.headers['x-request-id'] = rid;
    res.setHeader('x-request-id', rid);
    next();
  }
}
