import { Injectable, BadRequestException, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@matrixflow/db';

@Injectable()
export class BillingService {
  constructor(private prisma: PrismaService) {}

  async plans() {
    return this.prisma.plan.findMany({
      where: { isActive: true },
      orderBy: { priceMonthlyUsd: 'asc' },
    });
  }

  async current(organizationId: string) {
    return this.prisma.subscription.findFirst({
      where: { organizationId, status: 'active' },
      include: { plan: true },
    });
  }

  async subscribe(organizationId: string, planId: string, interval: 'month' | 'year' = 'month') {
    const plan = await this.prisma.plan.findUnique({ where: { id: planId } });
    if (!plan) throw new BadRequestException('Plan not found');
    const price = interval === 'year' ? plan.priceYearlyUsd : plan.priceMonthlyUsd;
    if (price > 0)
      throw new HttpException(
        'Paid subscription checkout is not configured',
        HttpStatus.PAYMENT_REQUIRED,
      );
    const start = new Date();
    const end = new Date();
    end.setMonth(end.getMonth() + (interval === 'year' ? 12 : 1));
    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`subscription:${organizationId}`}))`;
      const existing = await tx.subscription.findFirst({
        where: { organizationId, status: { in: ['active', 'trialing'] } },
        orderBy: { createdAt: 'desc' },
      });
      if (existing) {
        return tx.subscription.update({
          where: { id: existing.id },
          data: {
            planId,
            interval,
            status: 'active',
            currentPeriodStart: start,
            currentPeriodEnd: end,
            cancelAt: null,
            canceledAt: null,
          },
        });
      }
      return tx.subscription.create({
        data: {
          organizationId,
          planId,
          interval,
          status: 'active',
          currentPeriodStart: start,
          currentPeriodEnd: end,
        },
      });
    });
  }

  async usage(organizationId: string, metric?: string) {
    const since = new Date();
    since.setDate(1); // 本月
    const records = await this.prisma.usageRecord.findMany({
      where: { organizationId, recordedAt: { gte: since }, ...(metric ? { metric } : {}) },
    });
    const agg: Record<string, number> = {};
    for (const r of records) agg[r.metric] = (agg[r.metric] ?? 0) + r.value;
    return agg;
  }

  async invoices(organizationId: string) {
    return this.prisma.invoice.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async tokenUsage(organizationId: string) {
    const since = new Date();
    since.setDate(1);
    return this.prisma.tokenUsage.findMany({
      where: { organizationId, createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }
}
