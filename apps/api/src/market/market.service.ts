import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit.service';

@Injectable()
export class MarketService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  async list(filters: { type?: string; category?: string; q?: string; page?: number; pageSize?: number }) {
    const { type, category, q, page = 1, pageSize = 20 } = filters;
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
    const platformFee = item.priceUsd * 0.2;
    const devRevenue = item.priceUsd - platformFee;
    const p = await this.prisma.marketplacePurchase.create({ data: { itemId, buyerOrgId: organizationId, priceUsd: item.priceUsd, platformFeeUsd: platformFee, developerRevenueUsd: devRevenue } });
    await this.prisma.marketplaceItem.update({ where: { id: itemId }, data: { installs: { increment: 1 } } });
    await this.audit.log({ action: 'market.purchase', userId, organizationId, resource: 'item', resourceId: itemId, metadata: { price: item.priceUsd } as any });
    return { purchaseId: p.id, payload: item.payload };
  }

  async purchased(organizationId: string) {
    return this.prisma.marketplacePurchase.findMany({ where: { buyerOrgId: organizationId }, include: { item: true }, orderBy: { createdAt: 'desc' } });
  }

  async review(organizationId: string, userId: string, itemId: string, rating: number, comment?: string) {
    return this.prisma.marketplaceReview.upsert({ where: { itemId_authorId: { itemId, authorId: userId } }, update: { rating, comment }, create: { itemId, authorId: userId, rating, comment } });
  }

  private async uniqueSlug(name: string): Promise<string> {
    let slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'item';
    let i = 0; while (await this.prisma.marketplaceItem.findUnique({ where: { slug } })) { i++; slug = `${slug}-${i}`.slice(0, 60); }
    return slug;
  }
}
