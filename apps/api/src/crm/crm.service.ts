import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';
import { createCustomerSchema, createLeadSchema, sendCrmMessageSchema } from '@matrixflow/shared';
import { Prisma } from '@matrixflow/db';

@Injectable()
export class CrmService {
  constructor(
    private prisma: PrismaService,
    private ai: AiService,
  ) {}

  async listCustomers(organizationId: string, q?: string) {
    return this.prisma.customer.findMany({
      where: {
        organizationId,
        deletedAt: null,
        ...(q ? { OR: [{ name: { contains: q } }, { email: { contains: q } }] } : {}),
      },
      include: { tags: true, _count: { select: { conversations: true } } },
      orderBy: { lastActivityAt: 'desc' },
      take: 50,
    });
  }
  async getCustomer(organizationId: string, id: string) {
    const c = await this.prisma.customer.findFirst({
      where: { id, organizationId },
      include: {
        tags: true,
        notes: true,
        conversations: { include: { messages: { orderBy: { createdAt: 'asc' } } } },
      },
    });
    if (!c) throw new NotFoundException();
    return c;
  }
  async createCustomer(organizationId: string, input: unknown) {
    const data = createCustomerSchema.parse(input);
    return this.prisma.customer.create({
      data: {
        ...data,
        metadata: data.metadata as Prisma.InputJsonValue | undefined,
        organizationId,
      },
    });
  }
  async listLeads(organizationId: string) {
    return this.prisma.lead.findMany({
      where: { organizationId },
      include: { customer: true },
      orderBy: { score: 'desc' },
    });
  }
  async createLead(organizationId: string, input: unknown) {
    const { customerId, ...data } = createLeadSchema.parse(input);
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, organizationId, deletedAt: null },
      select: { id: true },
    });
    if (!customer) throw new NotFoundException('Customer not found');
    return this.prisma.lead.create({ data: { ...data, organizationId, customerId: customer.id } });
  }

  async conversations(organizationId: string) {
    return this.prisma.conversation.findMany({
      where: { organizationId },
      include: { customer: true, _count: { select: { messages: true } } },
      orderBy: { updatedAt: 'desc' },
      take: 50,
    });
  }
  async conversation(organizationId: string, id: string) {
    const c = await this.prisma.conversation.findFirst({
      where: { id, organizationId },
      include: { customer: true, messages: { orderBy: { createdAt: 'asc' } } },
    });
    if (!c) throw new NotFoundException();
    return c;
  }
  async sendMessage(organizationId: string, convId: string, input: unknown) {
    const { content } = sendCrmMessageSchema.parse(input);
    return this.prisma.$transaction(async (tx) => {
      const conversation = await tx.conversation.findFirst({
        where: { id: convId, organizationId },
        select: { id: true },
      });
      if (!conversation) throw new NotFoundException('Conversation not found');
      const message = await tx.message.create({
        data: { conversationId: conversation.id, role: 'agent', content },
      });
      await tx.conversation.update({
        where: { id: conversation.id },
        data: { updatedAt: new Date() },
      });
      return message;
    });
  }
  async aiReply(organizationId: string, convId: string, userId: string) {
    const conv = await this.conversation(organizationId, convId);
    const history = conv.messages.map((m: any) => `${m.role}: ${m.content}`).join('\n');
    const res = await this.ai.runPrompt({
      promptKey: 'customer_service_reply',
      variables: { history, customerName: conv.customer?.name ?? '' },
      organizationId,
      userId,
      responseFormat: 'json_object',
    });
    let parsed: any;
    try {
      parsed = JSON.parse(res.content);
    } catch {
      parsed = { reply: res.content };
    }
    return parsed;
  }
  async summarize(organizationId: string, convId: string, userId: string) {
    const conv = await this.conversation(organizationId, convId);
    const history = conv.messages.map((m: any) => `${m.role}: ${m.content}`).join('\n');
    const res = await this.ai.runPrompt({
      promptKey: 'conversation_summary',
      variables: { history },
      organizationId,
      userId,
      responseFormat: 'json_object',
    });
    const parsed = JSON.parse(res.content);
    await this.prisma.conversation.update({
      where: { id: convId },
      data: { summary: parsed.summary ?? res.content },
    });
    return parsed;
  }
  async followUps(organizationId: string) {
    return this.prisma.followUp.findMany({
      where: { customer: { organizationId }, status: 'pending' },
      include: { customer: true },
      orderBy: { dueAt: 'asc' },
    });
  }
}
