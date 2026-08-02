import { Injectable, BadRequestException, ConflictException, ForbiddenException, HttpException, HttpStatus, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit.service';

@Injectable()
export class MarketService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  async list(filters: { type?: string; category?: string; q?: string; page?: number; pageSize?: number }) {
    const { type, category, q } = filters;
    const page = Math.max(1, Number(filters.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(filters.pageSize) || 20));
    const where = { status: 'approved', deletedAt: null, ...(type ? { type } : {}), ...(category ? { category } : {}), ...(q ? { OR: [{ name: { contains: q } }, { description: { contains: q } }] } : {}) };
    const [data, total] = await Promise.all([
      this.prisma.marketplaceItem.findMany({ where, orderBy: { installs: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }),
      this.prisma.marketplaceItem.count({ where }),
    ]);
    return { data, total, page, pageSize };
  }

  async get(id: string) { const i = await this.prisma.marketplaceItem.findFirst({ where: { id, status: 'approved' }, include: { reviews: true } }); if (!i) throw new NotFoundException(); return i; }

  async publish(organizationId: string, userId: string, input: { type: string; name: string; description?: string; category?: string; priceUsd?: number; payload: any }) {
    const item = await this.prisma.marketplaceItem.create({ data: { organizationId, type: input.type, name: input.name, slug: await this.uniqueSlug(input.name), description: input.description, category: input.category, priceUsd: input.priceUsd ?? 0, payload: input.payload, status: 'pending' } });
    await this.audit.log({ action: 'market.publish', userId, organizationId, resource: 'item', resourceId: item.id });
    return item;
  }

  async purchase(organizationId: string, userId: string, itemId: string) {
    const item = await this.prisma.marketplaceItem.findUnique({ where: { id: itemId } });
    if (!item || item.status !== 'approved') throw new NotFoundException();
    if (item.priceUsd > 0) throw new HttpException('Paid marketplace checkout is not configured', HttpStatus.PAYMENT_REQUIRED);
    const platformFee = item.priceUsd * 0.2;
    const devRevenue = item.priceUsd - platformFee;
    const purchase = await this.prisma.$transaction(async (tx: any) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`market-purchase:${organizationId}:${itemId}`}))`;
      const existing = await tx.marketplacePurchase.findFirst({ where: { itemId, buyerOrgId: organizationId, status: 'paid' } });
      if (existing) throw new ConflictException('Item already purchased');
      const created = await tx.marketplacePurchase.create({ data: { itemId, buyerOrgId: organizationId, priceUsd: item.priceUsd, platformFeeUsd: platformFee, developerRevenueUsd: devRevenue } });
      await tx.marketplaceItem.update({ where: { id: itemId }, data: { installs: { increment: 1 } } });
      return created;
    });
    await this.audit.log({ action: 'market.purchase', userId, organizationId, resource: 'item', resourceId: itemId, metadata: { price: item.priceUsd } as any });
    return { purchaseId: purchase.id, payload: item.payload };
  }

  async purchased(organizationId: string) {
    return this.prisma.marketplacePurchase.findMany({ where: { buyerOrgId: organizationId }, include: { item: true }, orderBy: { createdAt: 'desc' } });
  }

  async review(organizationId: string, userId: string, itemId: string, rating: number, comment?: string) {
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new BadRequestException('Rating must be an integer from 1 to 5');
    const item = await this.prisma.marketplaceItem.findFirst({ where: { id: itemId, status: 'approved', deletedAt: null } });
    if (!item) throw new NotFoundException();
    const purchase = await this.prisma.marketplacePurchase.findFirst({ where: { itemId, buyerOrgId: organizationId, status: 'paid' } });
    if (!purchase) throw new ForbiddenException('Purchase required before reviewing an item');
    return this.prisma.marketplaceReview.upsert({ where: { itemId_authorId: { itemId, authorId: userId } }, update: { rating, comment }, create: { itemId, authorId: userId, rating, comment } });
  }

  private async uniqueSlug(name: string): Promise<string> {
    let slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'item';
    let i = 0; while (await this.prisma.marketplaceItem.findUnique({ where: { slug } })) { i++; slug = `${slug}-${i}`.slice(0, 60); }
    return slug;
  }
}
