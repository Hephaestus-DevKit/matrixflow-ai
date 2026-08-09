import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  ADMIN_ACTIONS,
  createOrgSchema,
  inviteMemberSchema,
  MEMBER_ACTIONS,
  RoleName,
  ErrorCode,
  Action,
} from '@matrixflow/shared';
import { AuditService } from '../common/audit.service';
import { Prisma } from '@matrixflow/db';

@Injectable()
export class OrgService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  async list(userId: string) {
    const ms = await this.prisma.organizationMember.findMany({
      where: { userId, organization: { deletedAt: null, status: { not: 'SUSPENDED' } } },
      include: { organization: true, role: { include: { permissions: true } } },
    });
    return ms.map((member) => ({
      id: member.organization.id,
      name: member.organization.name,
      slug: member.organization.slug,
      plan: member.organization.plan,
      role: member.role.name,
      permissions: member.role.permissions.map((permission) => permission.action),
    }));
  }

  async create(userId: string, input: unknown) {
    const dto = createOrgSchema.parse(input);
    const org = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`org-slug:${dto.slug}`}))`;
      const exists = await tx.organization.findUnique({ where: { slug: dto.slug } });
      if (exists) throw new ConflictException(ErrorCode.CONFLICT);
      const created = await tx.organization.create({
        data: { slug: dto.slug, name: dto.name, plan: 'FREE' },
      });
      const owner = await tx.role.create({
        data: { organizationId: created.id, name: RoleName.OWNER, isSystem: true },
      });
      const admin = await tx.role.create({
        data: { organizationId: created.id, name: RoleName.ADMIN, isSystem: true },
      });
      const member = await tx.role.create({
        data: { organizationId: created.id, name: RoleName.MEMBER, isSystem: true },
      });
      await tx.permission.createMany({
        data: Object.values(Action).map((action) => ({ roleId: owner.id, action })),
      });
      await tx.permission.createMany({
        data: ADMIN_ACTIONS.map((action) => ({ roleId: admin.id, action })),
      });
      await tx.permission.createMany({
        data: MEMBER_ACTIONS.map((action) => ({ roleId: member.id, action })),
      });
      await tx.organizationMember.create({
        data: { organizationId: created.id, userId, roleId: owner.id },
      });
      return created;
    });
    await this.audit.log({ action: 'org.create', userId, organizationId: org.id });
    return org;
  }

  async invite(userId: string, orgId: string, input: unknown) {
    const dto = inviteMemberSchema.parse(input);
    const target = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!target) throw new NotFoundException('User not found, ask them to register first');
    const role = await this.prisma.role.findFirst({
      where: { organizationId: orgId, name: dto.roleName },
    });
    if (!role) throw new NotFoundException('Role not found');
    const existing = await this.prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId: orgId, userId: target.id } },
    });
    if (existing) throw new ConflictException(ErrorCode.MEMBER_EXISTS);
    await this.prisma.organizationMember.create({
      data: {
        organizationId: orgId,
        userId: target.id,
        roleId: role.id,
        invitedByEmail: undefined,
      },
    });
    await this.audit.log({
      action: 'org.invite',
      userId,
      organizationId: orgId,
      resource: 'user',
      resourceId: target.id,
      metadata: { roleName: dto.roleName },
    });
    return { ok: true };
  }

  async members(_userId: string, orgId: string) {
    return this.prisma.organizationMember.findMany({
      where: { organizationId: orgId },
      select: {
        id: true,
        createdAt: true,
        user: { select: { id: true, email: true, name: true, avatarUrl: true, status: true } },
        role: { select: { id: true, name: true } },
      },
    });
  }

  async changeRole(userId: string, orgId: string, targetUserId: string, roleName: string) {
    if (userId === targetUserId) throw new ForbiddenException('Cannot change own role');
    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`org-owners:${orgId}`}))`;
      const role = await tx.role.findFirst({ where: { organizationId: orgId, name: roleName } });
      if (!role) throw new NotFoundException('Role not found');
      const member = await tx.organizationMember.findUnique({
        where: { organizationId_userId: { organizationId: orgId, userId: targetUserId } },
      });
      if (!member) throw new NotFoundException('Member not found');
      if (role.name !== RoleName.OWNER) await this.assertOwnerRemains(tx, orgId, member.roleId);
      await tx.organizationMember.update({ where: { id: member.id }, data: { roleId: role.id } });
    });
    await this.audit.log({
      action: 'org.changeRole',
      userId,
      organizationId: orgId,
      resource: 'user',
      resourceId: targetUserId,
      metadata: { roleName },
    });
    return { ok: true };
  }

  async remove(userId: string, orgId: string, targetUserId: string) {
    if (userId === targetUserId) throw new ForbiddenException('Cannot remove self');
    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`org-owners:${orgId}`}))`;
      const member = await tx.organizationMember.findUnique({
        where: { organizationId_userId: { organizationId: orgId, userId: targetUserId } },
      });
      if (!member) throw new NotFoundException('Member not found');
      await this.assertOwnerRemains(tx, orgId, member.roleId);
      await tx.organizationMember.delete({ where: { id: member.id } });
    });
    await this.audit.log({
      action: 'org.removeMember',
      userId,
      organizationId: orgId,
      resource: 'user',
      resourceId: targetUserId,
    });
    return { ok: true };
  }

  private async assertOwnerRemains(
    client: Prisma.TransactionClient,
    organizationId: string,
    roleId: string,
  ) {
    const role = await client.role.findUnique({ where: { id: roleId } });
    if (role?.name !== RoleName.OWNER) return;
    const ownerCount = await client.organizationMember.count({
      where: { organizationId, role: { name: RoleName.OWNER } },
    });
    if (ownerCount <= 1)
      throw new ForbiddenException('Organization must retain at least one owner');
  }
}
