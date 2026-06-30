import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';

@Injectable()
export class CrmService {
  constructor(private prisma: PrismaService, private ai: AiService) {}

  async listCustomers(organizationId: string, q?: string) {
    return this.prisma.customer.findMany({ where: { organizationId, deletedAt: null, ...(q ? { OR: [{ name: { contains: q } }, { email: { contains: q } }] } : {}) }, include: { tags: true, _count: { select: { conversations: true } } }, orderBy: { lastActivityAt: 'desc' }, take: 50 });
  }
  async getCustomer(organizationId: string, id: string) {
    const c = await this.prisma.customer.findFirst({ where: { id, organizationId }, include: { tags: true, notes: true, conversations: { include: { messages: { orderBy: { createdAt: 'asc' } } } } } });
    if (!c) throw new NotFoundException();
    return c;
  }
  async createCustomer(organizationId: string, data: any) { return this.prisma.customer.create({ data: { ...data, organizationId } }); }
  async listLeads(organizationId: string) { return this.prisma.lead.findMany({ where: { organizationId }, include: { customer: true }, orderBy: { score: 'desc' } }); }
  async createLead(organizationId: string, customerId: string, data: any) { return this.prisma.lead.create({ data: { ...data, organizationId, customerId } }); }

  async conversations(organizationId: string) { return this.prisma.conversation.findMany({ where: { organizationId }, include: { customer: true, _count: { select: { messages: true } } }, orderBy: { updatedAt: 'desc' }, take: 50 }); }
  async conversation(organizationId: string, id: string) { const c = await this.prisma.conversation.findFirst({ where: { id, organizationId }, include: { customer: true, messages: { orderBy: { createdAt: 'asc' } } } }); if (!c) throw new NotFoundException(); return c; }
  async sendMessage(organizationId: string, convId: string, role: string, content: string) {
    const msg = await this.prisma.message.create({ data: { conversationId: convId, role, content } });
    await this.prisma.conversation.update({ where: { id: convId }, data: { updatedAt: new Date() } });
    return msg;
  }
  async aiReply(organizationId: string, convId: string, userId: string) {
    const conv = await this.conversation(organizationId, convId);
    const history = conv.messages.map((m: any) => `${m.role}: ${m.content}`).join('\n');
    const res = await this.ai.runPrompt({ promptKey: 'customer_service_reply', variables: { history, customerName: conv.customer?.name ?? '' }, organizationId, userId, responseFormat: 'json_object' });
    let parsed: any; try { parsed = JSON.parse(res.content); } catch { parsed = { reply: res.content }; }
    return parsed;
  }
  async summarize(organizationId: string, convId: string, userId: string) {
    const conv = await this.conversation(organizationId, convId);
    const history = conv.messages.map((m: any) => `${m.role}: ${m.content}`).join('\n');
    const res = await this.ai.runPrompt({ promptKey: 'conversation_summary', variables: { history }, organizationId, userId, responseFormat: 'json_object' });
    const parsed = JSON.parse(res.content);
    await this.prisma.conversation.update({ where: { id: convId }, data: { summary: parsed.summary ?? res.content } });
    return parsed;
  }
  async followUps(organizationId: string) { return this.prisma.followUp.findMany({ where: { customer: { organizationId }, status: 'pending' }, include: { customer: true }, orderBy: { dueAt: 'asc' } }); }
}
