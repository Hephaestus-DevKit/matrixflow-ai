import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit.service';
import { WorkflowExecutor } from './workflow.executor';
import { QueueService } from '../queue/queue.service';
import { WorkflowEngine } from '@matrixflow/workflow-engine';
import { workflowDslSchema, type WorkflowDSL } from '@matrixflow/shared';
import { toInputJson } from '../common/prisma-json';

@Injectable()
export class WorkflowService {
  private readonly validator = new WorkflowEngine();
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private executor: WorkflowExecutor,
    private queue: QueueService,
  ) {}

  async list(organizationId: string) {
    return this.prisma.workflow.findMany({
      where: { organizationId, deletedAt: null },
      include: { _count: { select: { runs: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async get(organizationId: string, id: string) {
    const w = await this.prisma.workflow.findFirst({
      where: { id, organizationId, deletedAt: null },
      include: { versions: { orderBy: { version: 'desc' }, take: 10 }, triggers: true },
    });
    if (!w) throw new NotFoundException();
    return w;
  }

  async create(
    organizationId: string,
    userId: string,
    input: { name: string; description?: string; dsl: unknown },
  ) {
    if (!input.name?.trim() || input.name.trim().length > 100)
      throw new BadRequestException('Workflow name must contain 1-100 characters');
    const dsl = input.dsl;
    this.validateDsl(dsl);
    const result = await this.prisma.$transaction(async (tx) => {
      const wf = await tx.workflow.create({
        data: { organizationId, name: input.name, description: input.description },
      });
      const v = await tx.workflowVersion.create({
        data: {
          workflowId: wf.id,
          version: 1,
          dsl: toInputJson(dsl, 'workflow DSL'),
          createdBy: userId,
        },
      });
      await tx.workflow.update({ where: { id: wf.id }, data: { currentVersion: 1 } });
      return { ...wf, currentVersion: v.version, versions: [v] };
    });
    await this.audit.log({
      action: 'workflow.create',
      userId,
      organizationId,
      resource: 'workflow',
      resourceId: result.id,
    });
    return result;
  }

  async saveVersion(
    organizationId: string,
    userId: string,
    id: string,
    dsl: unknown,
    changeNote?: string,
  ) {
    this.validateDsl(dsl);
    const wf = await this.prisma.workflow.findFirst({
      where: { id, organizationId, deletedAt: null },
    });
    if (!wf) throw new NotFoundException();
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`workflow-version:${id}`}))`;
      const count = await tx.workflowVersion.count({ where: { workflowId: id } });
      const v = await tx.workflowVersion.create({
        data: {
          workflowId: id,
          version: count + 1,
          dsl: toInputJson(dsl, 'workflow DSL'),
          changeNote,
          createdBy: userId,
        },
      });
      await tx.workflow.update({ where: { id }, data: { currentVersion: v.version } });
      return v;
    });
  }

  async run(organizationId: string, userId: string, id: string, input?: unknown) {
    if (JSON.stringify(input ?? {}).length > 1_000_000)
      throw new BadRequestException('Workflow input is too large');
    const wf = await this.prisma.workflow.findFirst({
      where: { id, organizationId, deletedAt: null },
      include: { versions: { orderBy: { version: 'desc' }, take: 1 } },
    });
    if (!wf || !wf.versions[0]) throw new NotFoundException();
    const version = wf.versions[0];
    const run = await this.prisma.workflowRun.create({
      data: {
        workflowId: id,
        organizationId,
        version: version.version,
        status: 'PENDING',
        triggerType: 'manual',
        input: toInputJson(input ?? {}, 'workflow input'),
      },
    });
    try {
      await this.queue.enqueueWorkflow(run.id, userId);
      return { runId: run.id, status: 'PENDING' };
    } catch (e) {
      await this.prisma.workflowRun.update({
        where: { id: run.id },
        data: { status: 'FAILED', error: (e as Error).message, finishedAt: new Date() },
      });
      throw e;
    }
  }

  async processRun(runId: string, userId: string) {
    const run = await this.prisma.workflowRun.findUnique({ where: { id: runId } });
    if (!run) throw new NotFoundException();
    if (run.status === 'SUCCESS' || run.status === 'CANCELED') return { runId, status: run.status };
    const leaseCutoff = new Date(
      Date.now() - Number(process.env.WORKFLOW_RUN_LEASE_MS ?? 10 * 60_000),
    );
    const startedAt = new Date();
    const claimed = await this.prisma.workflowRun.updateMany({
      where: {
        id: runId,
        OR: [
          { status: { in: ['PENDING', 'FAILED'] } },
          { status: 'RUNNING', startedAt: { lt: leaseCutoff } },
        ],
      },
      data: { status: 'RUNNING', startedAt, finishedAt: null, error: null },
    });
    if (claimed.count !== 1) return { runId, status: run.status };
    const version = await this.prisma.workflowVersion.findUnique({
      where: { workflowId_version: { workflowId: run.workflowId, version: run.version } },
    });
    if (!version) throw new NotFoundException('Workflow version not found');

    await this.prisma.workflowRunLog.create({
      data: {
        runId,
        nodeKey: '__workflow__',
        level: 'info',
        message: 'Workflow execution started',
      },
    });
    try {
      const dsl: unknown = version.dsl;
      this.validateDsl(dsl);
      const output = await this.executor.execute(dsl, run.input ?? {}, {
        organizationId: run.organizationId,
        userId,
        workflowId: run.workflowId,
        runId,
      });
      await this.prisma.workflowRun.update({
        where: { id: runId },
        data: {
          status: 'SUCCESS',
          output: toInputJson(output, 'workflow output'),
          finishedAt: new Date(),
          durationMs: Date.now() - startedAt.getTime(),
        },
      });
      await this.prisma.workflowRunLog.create({
        data: {
          runId,
          nodeKey: '__workflow__',
          level: 'info',
          message: 'Workflow execution completed',
        },
      });
      return { runId, status: 'SUCCESS', output };
    } catch (error) {
      await this.prisma.workflowRun.update({
        where: { id: runId },
        data: {
          status: 'FAILED',
          error: (error as Error).message,
          finishedAt: new Date(),
          durationMs: Date.now() - startedAt.getTime(),
        },
      });
      await this.prisma.workflowRunLog.create({
        data: { runId, nodeKey: '__workflow__', level: 'error', message: (error as Error).message },
      });
      throw error;
    }
  }

  async logs(organizationId: string, id: string) {
    return this.prisma.workflowRun.findMany({
      where: { workflowId: id, organizationId },
      include: { logs: true },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });
  }

  async exportTemplate(organizationId: string, id: string) {
    const wf = await this.get(organizationId, id);
    return { name: wf.name, description: wf.description, dsl: wf.versions[0]?.dsl };
  }

  private validateDsl(value: unknown): asserts value is WorkflowDSL {
    const parsed = workflowDslSchema.safeParse(value);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues.map((issue) => issue.message).join('; '));
    }
    const validation = this.validator.validate(parsed.data);
    if (!validation.valid) throw new BadRequestException(validation.errors.join('; '));
  }
}
