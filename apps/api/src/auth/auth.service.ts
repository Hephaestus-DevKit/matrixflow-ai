import { Injectable, ConflictException, UnauthorizedException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { nanoid } from 'nanoid';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { ErrorCode, RoleName } from '@matrixflow/shared';
import { registerSchema, loginSchema } from '@matrixflow/shared';
import { AuditService } from '../common/audit.service';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private cfg: ConfigService,
    private redis: RedisService,
    private audit: AuditService,
  ) {}

  async syncUser(appwriteUser: { $id: string; email: string; name?: string }) {
    const appwriteId = appwriteUser.$id;
    const email = appwriteUser.email;
    const name = appwriteUser.name || email.split('@')[0] || 'User';

    // 1. Try to find the user by Appwrite account association
    let account = await this.prisma.account.findUnique({
      where: {
        provider_providerAccountId: {
          provider: 'appwrite',
          providerAccountId: appwriteId,
        },
      },
      include: { user: true },
    });

    let user: any = account?.user;

    // 2. If no account associated, try to find by email
    if (!user) {
      user = await this.prisma.user.findUnique({ where: { email } });

      if (user) {
        // Associate existing user with Appwrite
        await this.prisma.account.create({
          data: {
            provider: 'appwrite',
            providerAccountId: appwriteId,
            userId: user.id,
          },
        });
      } else {
        // 3. Create a new user with local UUID
        user = await this.prisma.user.create({
          data: {
            email,
            name,
            status: 'ACTIVE',
          },
        });

        // Create Appwrite association
        await this.prisma.account.create({
          data: {
            provider: 'appwrite',
            providerAccountId: appwriteId,
            userId: user.id,
          },
        });

        // Provision default organization, role, and permissions
        const slug = await this.uniqueSlug(name + "'s Team");
        const org = await this.prisma.organization.create({ data: { slug, name: name + "'s Team", plan: 'FREE' } });
        const role = await this.prisma.role.create({ data: { organizationId: org.id, name: RoleName.OWNER, isSystem: true } });
        await this.prisma.role.create({ data: { organizationId: org.id, name: RoleName.ADMIN, isSystem: true } });
        await this.prisma.role.create({ data: { organizationId: org.id, name: RoleName.MEMBER, isSystem: true } });
        
        const allPerms = [
          'agent:read','agent:write','agent:run','content:read','content:write','kb:read','kb:write',
          'workflow:read','workflow:write','workflow:run','crm:read','crm:write','org:manage',
          'org:read','org:write','billing:manage'
        ];
        await this.prisma.permission.createMany({ data: allPerms.map((a) => ({ roleId: role.id, action: a })) });
        await this.prisma.organizationMember.create({ data: { organizationId: org.id, userId: user.id, roleId: role.id } });
        
        await this.audit.log({ action: 'user.register.appwrite', userId: user.id, organizationId: org.id });

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          organizationId: org.id,
          role: RoleName.OWNER,
          permissions: allPerms,
        };
      }
    }

    // 4. User exists, load membership and permissions
    let membership = await this.prisma.organizationMember.findFirst({
      where: { userId: user.id },
      include: { role: { include: { permissions: true } }, organization: true }
    });

    if (!membership) {
      // Fallback: provision organization
      const slug = await this.uniqueSlug(user.name + "'s Team");
      const org = await this.prisma.organization.create({ data: { slug, name: user.name + "'s Team", plan: 'FREE' } });
      const role = await this.prisma.role.create({ data: { organizationId: org.id, name: RoleName.OWNER, isSystem: true } });
      await this.prisma.role.create({ data: { organizationId: org.id, name: RoleName.ADMIN, isSystem: true } });
      await this.prisma.role.create({ data: { organizationId: org.id, name: RoleName.MEMBER, isSystem: true } });
      const allPerms = [
        'agent:read','agent:write','agent:run','content:read','content:write','kb:read','kb:write',
        'workflow:read','workflow:write','workflow:run','crm:read','crm:write','org:manage',
        'org:read','org:write','billing:manage'
      ];
      await this.prisma.permission.createMany({ data: allPerms.map((a) => ({ roleId: role.id, action: a })) });
      membership = await this.prisma.organizationMember.create({
        data: { organizationId: org.id, userId: user.id, roleId: role.id },
        include: { role: { include: { permissions: true } }, organization: true }
      });
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
    const exists = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (exists) throw new ConflictException(ErrorCode.EMAIL_EXISTS);

    const hash = await bcrypt.hash(dto.password, Number(this.cfg.get('BCRYPT_ROUNDS', '12')));
    const user = await this.prisma.user.create({ data: { email: dto.email, name: dto.name, passwordHash: hash } });

    const slug = await this.uniqueSlug(dto.organizationName ?? `${dto.name}'s Team`);
    const org = await this.prisma.organization.create({ data: { slug, name: dto.organizationName ?? `${dto.name}'s Team`, plan: 'FREE' } });
    const role = await this.prisma.role.create({ data: { organizationId: org.id, name: RoleName.OWNER, isSystem: true } });
    await this.prisma.role.create({ data: { organizationId: org.id, name: RoleName.ADMIN, isSystem: true } });
    await this.prisma.role.create({ data: { organizationId: org.id, name: RoleName.MEMBER, isSystem: true } });
    const allPerms = ['agent:read','agent:write','agent:run','content:read','content:write','kb:read','kb:write','workflow:read','workflow:write','workflow:run','crm:read','crm:write','org:manage','org:read','org:write','billing:manage'];
    await this.prisma.permission.createMany({ data: allPerms.map((a) => ({ roleId: role.id, action: a })) });
    await this.prisma.organizationMember.create({ data: { organizationId: org.id, userId: user.id, roleId: role.id } });

    await this.audit.log({ action: 'user.register', userId: user.id, organizationId: org.id, ip, userAgent: ua });
    return this.issueTokens(user, org.id, RoleName.OWNER, allPerms);
  }

  async login(input: unknown, ip?: string, ua?: string) {
    const dto = loginSchema.parse(input);
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user || !user.passwordHash) throw new UnauthorizedException(ErrorCode.INVALID_CREDENTIALS);
    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) throw new UnauthorizedException(ErrorCode.INVALID_CREDENTIALS);

    const membership = await this.prisma.organizationMember.findFirst({ where: { userId: user.id }, include: { role: { include: { permissions: true } }, organization: true } });
    if (!membership) throw new NotFoundException(ErrorCode.ORG_NOT_FOUND);
    const perms = membership.role.permissions.map((p: any) => p.action);

    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    await this.audit.log({ action: 'user.login', userId: user.id, organizationId: membership.organizationId, ip, userAgent: ua });
    return this.issueTokens(user, membership.organizationId, membership.role.name, perms);
  }

  async refresh(refreshToken: string) {
    const sid = await this.redis.get<string>(`refresh:${refreshToken}`);
    if (!sid) throw new UnauthorizedException(ErrorCode.TOKEN_INVALID);
    const session = await this.prisma.session.findUnique({ where: { id: sid } });
    if (!session || session.revokedAt || session.expiresAt < new Date()) throw new UnauthorizedException(ErrorCode.TOKEN_EXPIRED);
    const user = await this.prisma.user.findUnique({ where: { id: session.userId } });
    if (!user) throw new UnauthorizedException(ErrorCode.TOKEN_INVALID);
    const membership = await this.prisma.organizationMember.findFirst({ where: { userId: user.id }, include: { role: { include: { permissions: true } } } });
    const perms = membership?.role.permissions.map((p: any) => p.action) ?? [];
    return this.issueTokens(user, membership!.organizationId, membership!.role.name, perms);
  }

  async logout(refreshToken: string) {
    const sid = await this.redis.get<string>(`refresh:${refreshToken}`);
    if (sid) { await this.prisma.session.update({ where: { id: sid }, data: { revokedAt: new Date() } }).catch(() => {}); await this.redis.del(`refresh:${refreshToken}`); }
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, include: { memberships: { include: { organization: true, role: { include: { permissions: true } } } } } });
    if (!user) throw new NotFoundException();
    return {
      id: user.id, email: user.email, name: user.name, avatarUrl: user.avatarUrl,
      memberships: user.memberships.map((m: any) => ({ organizationId: m.organizationId, organizationName: m.organization.name, slug: m.organization.slug, role: m.role.name, permissions: m.role.permissions.map((p: any) => p.action) })),
    };
  }

  async updateProfile(userId: string, data: { name?: string; avatarUrl?: string }) {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(data.name ? { name: data.name } : {}),
        ...(data.avatarUrl !== undefined ? { avatarUrl: data.avatarUrl } : {}),
      },
    });
    return this.me(userId);
  }

  private async issueTokens(user: { id: string; email: string; name: string }, orgId: string, role: string, perms: string[]) {
    const payload = { sub: user.id, email: user.email, name: user.name, oid: orgId, role, perms };
    const accessToken = await this.jwt.signAsync(payload);
    const refreshToken = nanoid(32);
    const session = await this.prisma.session.create({ data: { userId: user.id, refreshToken, expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000), userAgent: undefined, ip: undefined } });
    await this.redis.set(`refresh:${refreshToken}`, session.id, 7 * 24 * 3600);
    return { accessToken, refreshToken, user: { id: user.id, email: user.email, name: user.name }, organizationId: orgId, role, permissions: perms };
  }

  private async uniqueSlug(base: string): Promise<string> {
    let slug = base.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'team';
    if (slug.length < 3) slug = slug.padEnd(3, '0');
    let i = 0;
    while (await this.prisma.organization.findUnique({ where: { slug } })) { i += 1; slug = `${slug}-${i}`.slice(0, 40); }
    return slug;
  }
}
