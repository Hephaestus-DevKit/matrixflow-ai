import { SetMetadata } from '@nestjs/common';

export interface ReqUser {
  id: string;
  email: string;
  name: string;
  organizationId?: string;
  role?: string;
  permissions?: string[];
}

declare module 'express' {
  interface Request {
    user?: ReqUser;
  }
}

export const PERMS_KEY = 'perms';
export const RequireAction = (...actions: string[]) => SetMetadata(PERMS_KEY, actions);
