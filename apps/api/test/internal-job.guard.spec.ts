import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { InternalJobGuard } from '../src/jobs/internal-job.guard';

describe('InternalJobGuard', () => {
  const secret = 'a-secure-internal-secret-that-is-long';
  const config = { get: jest.fn(() => secret) };
  const guard = new InternalJobGuard(config as any);

  const context = (supplied: string): ExecutionContext =>
    ({
      switchToHttp: () => ({ getRequest: () => ({ header: () => supplied }) }),
    }) as any;

  it('accepts the configured secret', () => {
    expect(guard.canActivate(context(secret))).toBe(true);
  });

  it('rejects an incorrect secret', () => {
    expect(() => guard.canActivate(context('wrong'))).toThrow(ForbiddenException);
  });
});
