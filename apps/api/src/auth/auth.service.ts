import { BadRequestException, Injectable, ConflictException, UnauthorizedException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { nanoid } from 'nanoid';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { Action, ErrorCode, RoleName } from '@matrixflow/shared';
import { registerSchema, loginSchema } from '@matrixflow/shared';
import { AuditService } from '../common/audit.service';
import { createHash } from 'crypto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private cfg: ConfigService,
    private redis: RedisService,
    private audit: AuditService,
  ) {}

  verifyToken(token: string) {
    return this.jwt.verify(token);
  }

  async syncUser(appwriteUser: { $id: string; email: string; name?: string; emailVerification?: boolean }, targetOrgId?: string) {
    if (!appwriteUser.emailVerification) throw new UnauthorizedException('Verified email required');
    const appwriteId = appwriteUser.$id;
    const email = appwriteUser.email.trim().toLowerCase();
    const name = appwriteUser.name || email.split('@')[0] || 'User';
    const user = await this.prisma.$transaction(async (tx: any) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`appwrite:${appwriteId}`}))`;
      const linked = await tx.account.findUnique({
        where: { provider_providerAccountId: { provider: 'appwrite', providerAccountId: appwriteId } },
        include: { user: true },
      });
      if (linked) return linked.user;

      const existing = await tx.user.findUnique({ where: { email } });
      const resolvedUser = existing ?? await tx.user.create({ data: { email, name, status: 'ACTIVE' } });
      await tx.account.create({ data: { provider: 'appwrite', providerAccountId: appwriteId, userId: resolvedUser.id } });
      return resolvedUser;
    });

    if (user.status !== 'ACTIVE' || user.deletedAt) throw new UnauthorizedException(ErrorCode.FORBIDDEN);

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (targetOrgId && !isUuid.test(targetOrgId)) throw new UnauthorizedException(ErrorCode.FORBIDDEN);
    let membership: any = null;

    if (targetOrgId) {
      membership = await this.prisma.organizationMember.findFirst({
        where: { userId: user.id, organizationId: targetOrgId, organization: { deletedAt: null, status: { not: 'SUSPENDED' } } },
        include: { role: { include: { permissions: true } }, organization: true }
      });
      if (!membership) {
        throw new UnauthorizedException(ErrorCode.FORBIDDEN);
      }
    } else {
      membership = await this.prisma.organizationMember.findFirst({
        where: { userId: user.id, organization: { deletedAt: null, status: { not: 'SUSPENDED' } } },
        include: { role: { include: { permissions: true } }, organization: true }
      });
    }

    let provisionedOrgId: string | undefined;
    if (!membership && !targetOrgId) {
      const provisioned = await this.prisma.$transaction(async (tx: any) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`provision:${user.id}`}))`;
        const existing = await tx.organizationMember.findFirst({
          where: { userId: user.id, organization: { deletedAt: null, status: { not: 'SUSPENDED' } } },
          include: { role: { include: { permissions: true } }, organization: true },
        });
        if (existing) return { membership: existing, created: false };
        const created = await this.createDefaultOrganization(tx, user.id, `${user.name}'s Team`);
        return { membership: created, created: true };
      });
      membership = provisioned.membership;
      if (provisioned.created) provisionedOrgId = membership.organizationId;
    }

    if (!membership || membership.organization.status === 'SUSPENDED' || membership.organization.deletedAt) {
      throw new UnauthorizedException(ErrorCode.ORG_NOT_FOUND);
    }

    if (provisionedOrgId) {
      await this.audit.log({ action: 'user.register.appwrite', userId: user.id, organizationId: provisionedOrgId });
    }

    const permissions = membership.role.permissions.map((p: any) => p.action);
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      organizationId: membership.organizationId,
      role: membership.role.name,
      permissions,
    };
  }

  async register(input: unknown, ip?: string, ua?: string) {
    const dto = registerSchema.parse(input);
    const hash = await bcrypt.hash(dto.password, Number(this.cfg.get('BCRYPT_ROUNDS', '12')));
    const result = await this.prisma.$transaction(async (tx: any) => {
      const exists = await tx.user.findUnique({ where: { email: dto.email } });
      if (exists) throw new ConflictException(ErrorCode.EMAIL_EXISTS);
      const user = await tx.user.create({ data: { email: dto.email, name: dto.name, passwordHash: hash } });
      const membership = await this.createDefaultOrganization(tx, user.id, dto.organizationName ?? `${dto.name}'s Team`);
      return { user, org: membership.organization, permissions: membership.role.permissions.map((p: any) => p.action) };
    });

    await this.audit.log({ action: 'user.register', userId: result.user.id, organizationId: result.org.id, ip, userAgent: ua });
    return this.issueTokens(result.user, result.org.id, RoleName.OWNER, result.permissions);
  }

  async login(input: unknown, ip?: string, ua?: string) {
    const dto = loginSchema.parse(input);
    const user = await this.prisma.user.findUnique({ where: { email: dto.email }, omit: { passwordHash: false } });
    if (!user || !user.passwordHash || user.status !== 'ACTIVE' || user.deletedAt) throw new UnauthorizedException(ErrorCode.INVALID_CREDENTIALS);
    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) throw new UnauthorizedException(ErrorCode.INVALID_CREDENTIALS);

    const membership = await this.prisma.organizationMember.findFirst({ where: { userId: user.id, organization: { deletedAt: null, status: { not: 'SUSPENDED' } } }, include: { role: { include: { permissions: true } }, organization: true } });
    if (!membership) throw new NotFoundException(ErrorCode.ORG_NOT_FOUND);
    const perms = membership.role.permissions.map((p: any) => p.action);

    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    await this.audit.log({ action: 'user.login', userId: user.id, organizationId: membership.organizationId, ip, userAgent: ua });
    return this.issueTokens(user, membership.organizationId, membership.role.name, perms);
  }

  async refresh(refreshToken: string) {
    const tokenHash = this.hashToken(refreshToken);
    const refreshState = await this.redis.get<string | { sessionId: string; organizationId: string }>(`refresh:${tokenHash}`);
    if (!refreshState) throw new UnauthorizedException(ErrorCode.TOKEN_INVALID);
    const sid = typeof refreshState === 'string' ? refreshState : refreshState.sessionId;
    const organizationId = typeof refreshState === 'string' ? undefined : refreshState.organizationId;
    const session = await this.prisma.session.findUnique({
      where: { id: sid },
      omit: { refreshToken: false },
    });
    if (!session || session.refreshToken !== tokenHash || session.revokedAt || session.expiresAt < new Date()) throw new UnauthorizedException(ErrorCode.TOKEN_EXPIRED);
    const user = await this.prisma.user.findUnique({ where: { id: session.userId } });
    if (!user) throw new UnauthorizedException(ErrorCode.TOKEN_INVALID);
    if (user.status !== 'ACTIVE') throw new UnauthorizedException(ErrorCode.FORBIDDEN);
    const membership = await this.prisma.organizationMember.findFirst({
      where: { userId: user.id, ...(organizationId ? { organizationId } : {}), organization: { deletedAt: null, status: { not: 'SUSPENDED' } } },
      include: { role: { include: { permissions: true } }, organization: true },
    });
    if (!membership) throw new UnauthorizedException(ErrorCode.ORG_NOT_FOUND);
    const perms = membership.role.permissions.map((p: any) => p.action);
    // Atomically claim the current session before issuing its replacement.
    // Only one concurrent refresh request can rotate a given token.
    const claimed = await this.prisma.session.updateMany({
      where: { id: sid, refreshToken: tokenHash, revokedAt: null, expiresAt: { gt: new Date() } },
      data: { revokedAt: new Date() },
    });
    if (claimed.count !== 1) throw new UnauthorizedException(ErrorCode.TOKEN_INVALID);
    await this.redis.del(`refresh:${tokenHash}`);
    return this.issueTokens(user, membership.organizationId, membership.role.name, perms);
  }

  async logout(refreshToken: string) {
    const tokenHash = this.hashToken(refreshToken);
    const refreshState = await this.redis.get<string | { sessionId: string }>(`refresh:${tokenHash}`);
    const sid = typeof refreshState === 'string' ? refreshState : refreshState?.sessionId;
    if (sid) { await this.prisma.session.update({ where: { id: sid }, data: { revokedAt: new Date() } }).catch(() => {}); await this.redis.del(`refresh:${tokenHash}`); }
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, include: { memberships: { where: { organization: { deletedAt: null, status: { not: 'SUSPENDED' } } }, include: { organization: true, role: { include: { permissions: true } } } } } });
    if (!user) throw new NotFoundException();
    return {
      id: user.id, email: user.email, name: user.name, avatarUrl: user.avatarUrl,
      memberships: user.memberships.map((m: any) => ({ organizationId: m.organizationId, organizationName: m.organization.name, slug: m.organization.slug, role: m.role.name, permissions: m.role.permissions.map((p: any) => p.action) })),
    };
  }

  async updateProfile(userId: string, data: { name?: string; avatarUrl?: string }) {
    const name = data.name?.trim();
    if (data.name !== undefined && (!name || name.length > 100)) throw new BadRequestException('Name must contain 1-100 characters');
    if (data.avatarUrl !== undefined) this.assertSafeAvatarUrl(data.avatarUrl);
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(name ? { name } : {}),
        ...(data.avatarUrl !== undefined ? { avatarUrl: data.avatarUrl } : {}),
      },
    });
    return this.me(userId);
  }

  private async issueTokens(user: { id: string; email: string; name: string }, orgId: string, role: string, perms: string[]) {
    const payload = { sub: user.id, email: user.email, name: user.name, oid: orgId, role, perms };
    const accessToken = await this.jwt.signAsync(payload);
    const refreshToken = nanoid(48);
    const tokenHash = this.hashToken(refreshToken);
    const session = await this.prisma.session.create({ data: { userId: user.id, refreshToken: tokenHash, expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000), userAgent: undefined, ip: undefined } });
    await this.redis.set(`refresh:${tokenHash}`, { sessionId: session.id, organizationId: orgId }, 7 * 24 * 3600);
    return { accessToken, refreshToken, user: { id: user.id, email: user.email, name: user.name }, organizationId: orgId, role, permissions: perms };
  }

  private async createDefaultOrganization(tx: any, userId: string, organizationName: string) {
    let slugLock = organizationName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'team';
    if (slugLock.length < 3) slugLock = slugLock.padEnd(3, '0');
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`org-slug:${slugLock}`}))`;
    const slug = await this.uniqueSlug(organizationName, tx);
    const organization = await tx.organization.create({ data: { slug, name: organizationName, plan: 'FREE' } });
    const owner = await tx.role.create({ data: { organizationId: organization.id, name: RoleName.OWNER, isSystem: true } });
    const admin = await tx.role.create({ data: { organizationId: organization.id, name: RoleName.ADMIN, isSystem: true } });
    const member = await tx.role.create({ data: { organizationId: organization.id, name: RoleName.MEMBER, isSystem: true } });
    const ownerPermissions = Object.values(Action);
    const adminPermissions = [Action.AGENT_READ, Action.AGENT_WRITE, Action.AGENT_RUN, Action.CONTENT_READ, Action.CONTENT_WRITE, Action.KB_READ, Action.KB_WRITE, Action.WORKFLOW_READ, Action.WORKFLOW_WRITE, Action.WORKFLOW_RUN, Action.CRM_READ, Action.CRM_WRITE];
    const memberPermissions = [Action.AGENT_READ, Action.CONTENT_READ, Action.KB_READ, Action.WORKFLOW_READ, Action.CRM_READ];
    await tx.permission.createMany({ data: ownerPermissions.map((action) => ({ roleId: owner.id, action })) });
    await tx.permission.createMany({ data: adminPermissions.map((action) => ({ roleId: admin.id, action })) });
    await tx.permission.createMany({ data: memberPermissions.map((action) => ({ roleId: member.id, action })) });
    return tx.organizationMember.create({
      data: { organizationId: organization.id, userId, roleId: owner.id },
      include: { role: { include: { permissions: true } }, organization: true },
    });
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private assertSafeAvatarUrl(value: string) {
    if (!value) return;
    if (value.length > 2_048) throw new BadRequestException('Avatar URL is too long');
    if (value.startsWith('data:image/svg+xml;utf8,')) {
      const normalized = value.toLowerCase();
      if (normalized.includes('<script') || /on[a-z]+\s*=/.test(normalized) || normalized.includes('javascript:')) {
        throw new BadRequestException('Unsafe avatar data');
      }
      return;
    }
    let url: URL;
    try { url = new URL(value); } catch { throw new BadRequestException('Invalid avatar URL'); }
    if (url.protocol !== 'https:' && !(process.env.NODE_ENV !== 'production' && url.protocol === 'http:')) {
      throw new BadRequestException('Avatar URL must use HTTPS');
    }
  }

  private async uniqueSlug(base: string, client: any = this.prisma): Promise<string> {
    let slug = base.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'team';
    if (slug.length < 3) slug = slug.padEnd(3, '0');
    let i = 0;
    while (await client.organization.findUnique({ where: { slug } })) { i += 1; slug = `${slug}-${i}`.slice(0, 40); }
    return slug;
  }
}
