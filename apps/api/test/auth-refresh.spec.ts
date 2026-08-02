import { UnauthorizedException } from '@nestjs/common';
import { createHash } from 'crypto';
import { AuthService } from '../src/auth/auth.service';

describe('AuthService refresh rotation', () => {
  const token = 'raw-refresh-token';
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const user = { id: 'user-1', email: 'user@example.com', name: 'User', status: 'ACTIVE' };
  const membership = {
    organizationId: 'org-1',
    organization: { status: 'ACTIVE', deletedAt: null },
    role: { name: 'OWNER', permissions: [{ action: 'agent:read' }] },
  };

  function makeService(claimCount: number) {
    const prisma = {
      session: {
        findUnique: jest.fn().mockResolvedValue({ id: 'session-1', userId: user.id, refreshToken: tokenHash, revokedAt: null, expiresAt: new Date(Date.now() + 60_000) }),
        updateMany: jest.fn().mockResolvedValue({ count: claimCount }),
        create: jest.fn().mockResolvedValue({ id: 'session-2' }),
      },
      user: { findUnique: jest.fn().mockResolvedValue(user) },
      organizationMember: { findFirst: jest.fn().mockResolvedValue(membership) },
    };
    const redis = {
      get: jest.fn().mockResolvedValue({ sessionId: 'session-1', organizationId: 'org-1' }),
      del: jest.fn().mockResolvedValue(undefined),
      set: jest.fn().mockResolvedValue(undefined),
    };
    const jwt = { signAsync: jest.fn().mockResolvedValue('access-token') };
    const service = new AuthService(prisma as any, jwt as any, { get: jest.fn() } as any, redis as any, { log: jest.fn() } as any);
    return { service, prisma, redis };
  }

  it('rejects a refresh token that another request already claimed', async () => {
    const { service, prisma, redis } = makeService(0);

    await expect(service.refresh(token)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.session.create).not.toHaveBeenCalled();
    expect(redis.del).not.toHaveBeenCalled();
  });

  it('keeps the refreshed access token bound to the original organization', async () => {
    const { service, prisma, redis } = makeService(1);

    const result = await service.refresh(token);

    expect(result.organizationId).toBe('org-1');
    expect(prisma.organizationMember.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ organizationId: 'org-1' }),
    }));
    expect(redis.del).toHaveBeenCalledTimes(1);
    expect(redis.set).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ organizationId: 'org-1' }), expect.any(Number));
  });
});
