import {
  Injectable,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit.service';
import {
  marketListSchema,
  marketplaceReviewSchema,
  publishMarketplaceItemSchema,
} from '@matrixflow/shared';
import { Prisma } from '@matrixflow/db';
import { toInputJson } from '../common/prisma-json';

const publicItemSelect = {
  id: true,
  organizationId: true,
  type: true,
  name: true,
  slug: true,
  description: true,
  longDescription: true,
  category: true,
  tags: true,
  priceUsd: true,
  iconUrl: true,
  coverUrl: true,
  installs: true,
  ratingAvg: true,
  ratingCount: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.MarketplaceItemSelect;

@Injectable()
export class MarketService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  async list(input: unknown) {
    const { type, category, q, page, pageSize } = marketListSchema.parse(input);
    const where = {
      status: 'approved',
      deletedAt: null,
      ...(type ? { type } : {}),
      ...(category ? { category } : {}),
      ...(q ? { OR: [{ name: { contains: q } }, { description: { contains: q } }] } : {}),
    };
    const [data, total] = await Promise.all([
      this.prisma.marketplaceItem.findMany({
        where,
        orderBy: { installs: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: publicItemSelect,
      }),
      this.prisma.marketplaceItem.count({ where }),
    ]);
    return { data, total, page, pageSize };
  }

  async get(id: string) {
    const i = await this.prisma.marketplaceItem.findFirst({
      where: { id, status: 'approved', deletedAt: null },
      select: {
        ...publicItemSelect,
        reviews: {
          select: { id: true, rating: true, comment: true, createdAt: true, updatedAt: true },
          orderBy: { createdAt: 'desc' },
          take: 100,
        },
      },
    });
    if (!i) throw new NotFoundException();
    return i;
  }

  async publish(organizationId: string, userId: string, rawInput: unknown) {
    const input = publishMarketplaceItemSchema.parse(rawInput);
    const item = await this.prisma.marketplaceItem.create({
      data: {
        organizationId,
        type: input.type,
        name: input.name,
        slug: await this.uniqueSlug(input.name),
        description: input.description,
        category: input.category,
        priceUsd: input.priceUsd,
        payload: toInputJson(input.payload, 'marketplace payload'),
        status: 'pending',
      },
    });
    await this.audit.log({
      action: 'market.publish',
      userId,
      organizationId,
      resource: 'item',
      resourceId: item.id,
    });
    return item;
  }

  async purchase(organizationId: string, userId: string, itemId: string) {
    const result = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`market-purchase:${organizationId}:${itemId}`}))`;
      const item = await tx.marketplaceItem.findFirst({
        where: { id: itemId, status: 'approved', deletedAt: null },
      });
      if (!item) throw new NotFoundException();
      if (item.organizationId === organizationId)
        throw new ForbiddenException('Publishers cannot purchase their own item');
      if (item.priceUsd > 0)
        throw new HttpException(
          'Paid marketplace checkout is not configured',
          HttpStatus.PAYMENT_REQUIRED,
        );
      const existing = await tx.marketplacePurchase.findFirst({
        where: { itemId, buyerOrgId: organizationId, status: 'paid' },
      });
      if (existing) throw new ConflictException('Item already purchased');
      const platformFee = item.priceUsd * 0.2;
      const devRevenue = item.priceUsd - platformFee;
      const created = await tx.marketplacePurchase.create({
        data: {
          itemId,
          buyerOrgId: organizationId,
          priceUsd: item.priceUsd,
          platformFeeUsd: platformFee,
          developerRevenueUsd: devRevenue,
        },
      });
      await tx.marketplaceItem.update({
        where: { id: itemId },
        data: { installs: { increment: 1 } },
      });
      return { purchase: created, item };
    });
    await this.audit.log({
      action: 'market.purchase',
      userId,
      organizationId,
      resource: 'item',
      resourceId: itemId,
      metadata: toInputJson({ price: result.item.priceUsd }, 'purchase audit metadata'),
    });
    return { purchaseId: result.purchase.id, payload: result.item.payload };
  }

  async purchased(organizationId: string) {
    return this.prisma.marketplacePurchase.findMany({
      where: { buyerOrgId: organizationId, status: 'paid' },
      include: { item: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async review(organizationId: string, userId: string, itemId: string, input: unknown) {
    const { rating, comment } = marketplaceReviewSchema.parse(input);
    const item = await this.prisma.marketplaceItem.findFirst({
      where: { id: itemId, status: 'approved', deletedAt: null },
    });
    if (!item) throw new NotFoundException();
    const purchase = await this.prisma.marketplacePurchase.findFirst({
      where: { itemId, buyerOrgId: organizationId, status: 'paid' },
    });
    if (!purchase) throw new ForbiddenException('Purchase required before reviewing an item');
    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`market-review:${itemId}`}))`;
      const review = await tx.marketplaceReview.upsert({
        where: { itemId_authorId: { itemId, authorId: userId } },
        update: { rating, comment },
        create: { itemId, authorId: userId, rating, comment },
      });
      const aggregate = await tx.marketplaceReview.aggregate({
        where: { itemId },
        _avg: { rating: true },
        _count: { _all: true },
      });
      await tx.marketplaceItem.update({
        where: { id: itemId },
        data: {
          ratingAvg: aggregate._avg.rating ?? 0,
          ratingCount: aggregate._count._all,
        },
      });
      return review;
    });
  }

  private async uniqueSlug(name: string): Promise<string> {
    let slug =
      name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 60) || 'item';
    let i = 0;
    while (await this.prisma.marketplaceItem.findUnique({ where: { slug } })) {
      i++;
      slug = `${slug}-${i}`.slice(0, 60);
    }
    return slug;
  }
}
