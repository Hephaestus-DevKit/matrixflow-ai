import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit.service';
import { WorkflowExecutor } from './executor';

@Injectable()
export class WorkflowService {
  constructor(private prisma: PrismaService, private audit: AuditService, private executor: WorkflowExecutor) {}

  async list(organizationId: string) {
    return this.prisma.workflow.findMany({ where: { organizationId, deletedAt: null }, include: { _count: { select: { runs: true } } }, orderBy: { createdAt: 'desc' } });
  }

  async get(organizationId: string, id: string) {
    const w = await this.prisma.workflow.findFirst({ where: { id, organizationId, deletedAt: null }, include: { versions: { orderBy: { version: 'desc' }, take: 10 }, triggers: true } });
    if (!w) throw new NotFoundException();
    return w;
  }

  async create(organizationId: string, userId: string, input: { name: string; description?: string; dsl: any }) {
    return this.prisma.$transaction(async (tx: any) => {
      const wf = await tx.workflow.create({ data: { organizationId, name: input.name, description: input.description } });
      const v = await tx.workflowVersion.create({ data: { workflowId: wf.id, version: 1, dsl: input.dsl, createdBy: userId } });
      await tx.workflow.update({ where: { id: wf.id }, data: { currentVersion: 1 } });
      await this.audit.log({ action: 'workflow.create', userId, organizationId, resource: 'workflow', resourceId: wf.id });
      return { ...wf, currentVersion: v };
    });
  }

  async saveVersion(organizationId: string, userId: string, id: string, dsl: any, changeNote?: string) {
    const wf = await this.prisma.workflow.findFirst({ where: { id, organizationId } });
    if (!wf) throw new NotFoundException();
    return this.prisma.$transaction(async (tx: any) => {
      const count = await tx.workflowVersion.count({ where: { workflowId: id } });
      const v = await tx.workflowVersion.create({ data: { workflowId: id, version: count + 1, dsl, changeNote, createdBy: userId } });
      await tx.workflow.update({ where: { id }, data: { currentVersion: v.version } });
      return v;
    });
  }

  async run(organizationId: string, userId: string, id: string, input?: any) {
    const wf = await this.prisma.workflow.findFirst({ where: { id, organizationId }, include: { versions: { orderBy: { version: 'desc' }, take: 1 } } });
    if (!wf || !wf.versions[0]) throw new NotFoundException();
    const version = wf.versions[0];
    const run = await this.prisma.workflowRun.create({ data: { workflowId: id, organizationId, version: version.version, status: 'RUNNING', triggerType: 'manual', input: input ?? {}, startedAt: new Date() } });
    try {
      const out = await this.executor.execute(version.dsl as any, input ?? {}, { organizationId, userId, workflowId: id, runId: run.id });
      await this.prisma.workflowRun.update({ where: { id: run.id }, data: { status: 'SUCCESS', output: out as any, finishedAt: new Date(), durationMs: Date.now() - run.startedAt!.getTime() } });
      return { runId: run.id, output: out };
    } catch (e) {
      await this.prisma.workflowRun.update({ where: { id: run.id }, data: { status: 'FAILED', error: (e as Error).message, finishedAt: new Date() } });
      throw e;
    }
  }

  async logs(organizationId: string, id: string) {
    return this.prisma.workflowRun.findMany({ where: { workflowId: id, organizationId }, include: { logs: true }, orderBy: { createdAt: 'desc' }, take: 30 });
  }

  async exportTemplate(organizationId: string, id: string) {
    const wf = await this.get(organizationId, id);
    return { name: wf.name, description: wf.description, dsl: wf.versions[0]?.dsl };
  }
}
