import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';
import { createAgentSchema, runAgentSchema } from '@matrixflow/shared';
import { AuditService } from '../common/audit.service';

@Injectable()
export class AgentService {
  constructor(
    private prisma: PrismaService,
    private ai: AiService,
    private audit: AuditService,
  ) {}

  async list(organizationId: string) {
    return this.prisma.agent.findMany({
      where: { organizationId, deletedAt: null },
      include: { skills: true, tools: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async get(organizationId: string, id: string) {
    const a = await this.prisma.agent.findFirst({
      where: { id, organizationId, deletedAt: null },
      include: { skills: true, tools: true, runs: { take: 20, orderBy: { createdAt: 'desc' } } },
    });
    if (!a) throw new NotFoundException();
    return a;
  }

  async create(organizationId: string, userId: string, input: unknown) {
    const dto = createAgentSchema.parse(input);
    const { skills, tools, ...data } = dto;
    const agent = await this.prisma.agent.create({
      data: {
        ...data,
        organizationId,
        systemPrompt: data.systemPrompt as any,
        skills: { create: skills },
        tools: { create: tools },
      },
    });
    await this.audit.log({
      action: 'agent.create',
      userId,
      organizationId,
      resource: 'agent',
      resourceId: agent.id,
    });
    return agent;
  }

  async update(organizationId: string, userId: string, id: string, input: unknown) {
    const dto = createAgentSchema.partial().parse(input);
    const { skills, tools, ...data } = dto;
    return this.prisma.$transaction(async (tx: any) => {
      const existing = await tx.agent.findFirst({ where: { id, organizationId, deletedAt: null } });
      if (!existing) throw new NotFoundException();
      const agent = await tx.agent.update({
        where: { id },
        data: { ...data, systemPrompt: data.systemPrompt as any },
      });
      if (skills) {
        await tx.agentSkill.deleteMany({ where: { agentId: id } });
        await tx.agentSkill.createMany({
          data: skills.map((s) => ({ agentId: id, skillKey: s.skillKey, config: s.config as any })),
        });
      }
      if (tools) {
        await tx.agentTool.deleteMany({ where: { agentId: id } });
        await tx.agentTool.createMany({
          data: tools.map((t) => ({ agentId: id, toolKey: t.toolKey, config: t.config as any })),
        });
      }
      await this.audit.log({
        action: 'agent.update',
        userId,
        organizationId,
        resource: 'agent',
        resourceId: id,
      });
      return agent;
    });
  }

  async remove(organizationId: string, userId: string, id: string) {
    const result = await this.prisma.agent.updateMany({
      where: { id, organizationId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    if (result.count === 0) throw new NotFoundException();
    await this.audit.log({
      action: 'agent.delete',
      userId,
      organizationId,
      resource: 'agent',
      resourceId: id,
    });
    return { ok: true };
  }

  async run(organizationId: string, userId: string, id: string, input: unknown) {
    const dto = runAgentSchema.parse(input);
    const agent = await this.prisma.agent.findFirst({
      where: { id, organizationId, deletedAt: null },
    });
    if (!agent) throw new NotFoundException();
    const run = await this.prisma.agentRun.create({
      data: {
        agentId: id,
        organizationId,
        input: dto.input as any,
        status: 'RUNNING',
        startedAt: new Date(),
      },
    });
    try {
      const promptKey = (agent.systemPrompt as any)?.templateKey ?? 'rag_qa';
      const result = await this.ai.runPrompt({
        promptKey,
        variables: dto.input,
        organizationId,
        userId,
        agentId: id,
      });
      await this.prisma.agentRun.update({
        where: { id: run.id },
        data: {
          status: 'SUCCESS',
          output: { content: result.content } as any,
          tokensUsed: result.usage.totalTokens,
          costUsd: result.costUsd,
          finishedAt: new Date(),
          durationMs: Date.now() - run.startedAt!.getTime(),
        },
      });
      return { runId: run.id, output: result.content, usage: result.usage };
    } catch (e) {
      await this.prisma.agentRun.update({
        where: { id: run.id },
        data: { status: 'FAILED', error: (e as Error).message, finishedAt: new Date() },
      });
      throw e;
    }
  }

  async logs(organizationId: string, id: string) {
    return this.prisma.agentRun.findMany({
      where: { agentId: id, organizationId },
      include: { logs: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async createFromTemplate(
    organizationId: string,
    userId: string,
    templateId: string,
    name?: string,
  ) {
    const tpl = await this.prisma.agentTemplate.findUnique({ where: { id: templateId } });
    if (!tpl) throw new NotFoundException('Template not found');
    const agent = await this.prisma.agent.create({
      data: {
        organizationId,
        name: name ?? tpl.name,
        role: tpl.role,
        description: tpl.description,
        systemPrompt: tpl.systemPrompt as any,
        skills: { create: tpl.defaultSkills.map((k: any) => ({ skillKey: k })) },
        tools: { create: tpl.defaultTools.map((k: any) => ({ toolKey: k })) },
      },
    });
    await this.prisma.agentTemplate.update({
      where: { id: templateId },
      data: { installs: { increment: 1 } },
    });
    await this.audit.log({
      action: 'agent.createFromTemplate',
      userId,
      organizationId,
      resource: 'agent',
      resourceId: agent.id,
      metadata: { templateId } as any,
    });
    return agent;
  }
}
