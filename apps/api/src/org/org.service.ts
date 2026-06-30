import { Injectable, NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { createOrgSchema, inviteMemberSchema, RoleName, ErrorCode, Action } from '@matrixflow/shared';
import { AuditService } from '../common/audit.service';

@Injectable()
export class OrgService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  async list(userId: string) {
    const ms = await this.prisma.organizationMember.findMany({ where: { userId }, include: { organization: true, role: { include: { permissions: true } } } });
    return ms.map((m: any) => ({ id: m.organization.id, name: m.organization.name, slug: m.organization.slug, plan: m.organization.plan, role: m.role.name, permissions: m.role.permissions.map((p: any) => p.action) }));
  }

  async create(userId: string, input: unknown) {
    const dto = createOrgSchema.parse(input);
    const exists = await this.prisma.organization.findUnique({ where: { slug: dto.slug } });
    if (exists) throw new ConflictException(ErrorCode.CONFLICT);
    const org = await this.prisma.organization.create({ data: { slug: dto.slug, name: dto.name, plan: 'FREE' } });
    const owner = await this.prisma.role.create({ data: { organizationId: org.id, name: RoleName.OWNER, isSystem: true } });
    const admin = await this.prisma.role.create({ data: { organizationId: org.id, name: RoleName.ADMIN, isSystem: true } });
    const member = await this.prisma.role.create({ data: { organizationId: org.id, name: RoleName.MEMBER, isSystem: true } });
    const allPerms = Object.values(Action);
    await this.prisma.permission.createMany({ data: allPerms.map((a) => ({ roleId: owner.id, action: a })) });
    await this.prisma.permission.createMany({ data: [Action.AGENT_READ, Action.AGENT_WRITE, Action.AGENT_RUN, Action.CONTENT_READ, Action.CONTENT_WRITE, Action.KB_READ, Action.KB_WRITE, Action.WORKFLOW_READ, Action.WORKFLOW_RUN, Action.CRM_READ, Action.CRM_WRITE].map((a) => ({ roleId: admin.id, action: a })) });
    await this.prisma.permission.createMany({ data: [Action.AGENT_READ, Action.CONTENT_READ, Action.KB_READ, Action.WORKFLOW_READ, Action.CRM_READ].map((a) => ({ roleId: member.id, action: a })) });
    await this.prisma.organizationMember.create({ data: { organizationId: org.id, userId, roleId: owner.id } });
    await this.audit.log({ action: 'org.create', userId, organizationId: org.id });
    return org;
  }

  async invite(userId: string, orgId: string, input: unknown) {
    const dto = inviteMemberSchema.parse(input);
    const target = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!target) throw new NotFoundException('User not found, ask them to register first');
    const role = await this.prisma.role.findFirst({ where: { organizationId: orgId, name: dto.roleName } });
    if (!role) throw new NotFoundException('Role not found');
    const existing = await this.prisma.organizationMember.findUnique({ where: { organizationId_userId: { organizationId: orgId, userId: target.id } } });
    if (existing) throw new ConflictException(ErrorCode.MEMBER_EXISTS);
    await this.prisma.organizationMember.create({ data: { organizationId: orgId, userId: target.id, roleId: role.id, invitedByEmail: undefined } });
    await this.audit.log({ action: 'org.invite', userId, organizationId: orgId, resource: 'user', resourceId: target.id, metadata: { roleName: dto.roleName } });
    return { ok: true };
  }

  async members(userId: string, orgId: string) {
    return this.prisma.organizationMember.findMany({ where: { organizationId: orgId }, include: { user: true, role: true } });
  }

  async changeRole(userId: string, orgId: string, targetUserId: string, roleName: string) {
    if (userId === targetUserId) throw new ForbiddenException('Cannot change own role');
    const role = await this.prisma.role.findFirst({ where: { organizationId: orgId, name: roleName } });
    if (!role) throw new NotFoundException('Role not found');
    const m = await this.prisma.organizationMember.findUnique({ where: { organizationId_userId: { organizationId: orgId, userId: targetUserId } } });
    if (!m) throw new NotFoundException('Member not found');
    await this.prisma.organizationMember.update({ where: { id: m.id }, data: { roleId: role.id } });
    await this.audit.log({ action: 'org.changeRole', userId, organizationId: orgId, resource: 'user', resourceId: targetUserId, metadata: { roleName } });
    return { ok: true };
  }

  async remove(userId: string, orgId: string, targetUserId: string) {
    if (userId === targetUserId) throw new ForbiddenException('Cannot remove self');
    const m = await this.prisma.organizationMember.findUnique({ where: { organizationId_userId: { organizationId: orgId, userId: targetUserId } } });
    if (!m) throw new NotFoundException('Member not found');
    await this.prisma.organizationMember.delete({ where: { id: m.id } });
    await this.audit.log({ action: 'org.removeMember', userId, organizationId: orgId, resource: 'user', resourceId: targetUserId });
    return { ok: true };
  }
}
