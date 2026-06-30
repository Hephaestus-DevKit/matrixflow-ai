import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  async users(page = 1, pageSize = 20, q?: string) {
    const where = q ? { OR: [{ email: { contains: q } }, { name: { contains: q } }] } : {};
    const [data, total] = await Promise.all([this.prisma.user.findMany({ where, skip: (page - 1) * pageSize, take: pageSize, orderBy: { createdAt: 'desc' } }), this.prisma.user.count({ where })]);
    return { data, total, page, pageSize };
  }
  async orgs(page = 1, pageSize = 20) {
    const [data, total] = await Promise.all([this.prisma.organization.findMany({ skip: (page - 1) * pageSize, take: pageSize, orderBy: { createdAt: 'desc' } }), this.prisma.organization.count()]);
    return { data, total, page, pageSize };
  }
  async revenue() {
    const since = new Date(); since.setDate(1);
    const items = await this.prisma.usageRecord.findMany({ where: { recordedAt: { gte: since } } });
    const aiCalls = items.filter((i: any) => i.metric === 'ai_call').reduce((s: any, i: any) => s + i.value, 0);
    const tokenIn = items.filter((i: any) => i.metric === 'token_input').reduce((s: any, i: any) => s + i.value, 0);
    const tokenOut = items.filter((i: any) => i.metric === 'token_output').reduce((s: any, i: any) => s + i.value, 0);
    const tokenUsage = await this.prisma.tokenUsage.aggregate({ _sum: { costUsd: true }, where: { createdAt: { gte: since } } });
    const mkt = await this.prisma.marketplacePurchase.aggregate({ _sum: { platformFeeUsd: true }, where: { createdAt: { gte: since } } });
    return { aiCalls, tokenIn, tokenOut, aiCostUsd: tokenUsage._sum.costUsd ?? 0, marketplaceRevenueUsd: mkt._sum.platformFeeUsd ?? 0 };
  }
  async modelMonitor() {
    const since = new Date(); since.setHours(0, 0, 0, 0);
    return this.prisma.tokenUsage.groupBy({ by: ['provider', 'model'], where: { createdAt: { gte: since } }, _sum: { inputTokens: true, outputTokens: true, costUsd: true }, _count: true });
  }
  async pendingItems() { return this.prisma.marketplaceItem.findMany({ where: { status: 'pending' }, orderBy: { createdAt: 'asc' } }); }
  async approveItem(id: string) { return this.prisma.marketplaceItem.update({ where: { id }, data: { status: 'approved' } }); }
  async rejectItem(id: string, reason: string) { return this.prisma.marketplaceItem.update({ where: { id }, data: { status: 'rejected', metadata: { reason } } as any }); }
  async auditLogs(page = 1, pageSize = 50) {
    const [data, total] = await Promise.all([this.prisma.auditLog.findMany({ skip: (page - 1) * pageSize, take: pageSize, orderBy: { createdAt: 'desc' } }), this.prisma.auditLog.count()]);
    return { data, total, page, pageSize };
  }
}
