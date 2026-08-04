import { ForbiddenException } from '@nestjs/common';
import { MarketService } from '../src/market/market.service';

describe('MarketService disclosure and integrity controls', () => {
  it('never selects template payloads for public listings', async () => {
    const prisma = {
      marketplaceItem: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
    };
    const service = new MarketService(prisma as any, {} as any);

    await service.list({ page: 1, pageSize: 20 });

    const query = prisma.marketplaceItem.findMany.mock.calls[0][0];
    expect(query.select.payload).toBeUndefined();
    expect(query.select.name).toBe(true);
  });

  it('does not expose payloads from the public detail endpoint', async () => {
    const prisma = {
      marketplaceItem: { findFirst: jest.fn().mockResolvedValue({ id: 'item-1' }) },
    };
    const service = new MarketService(prisma as any, {} as any);

    await service.get('item-1');

    const query = prisma.marketplaceItem.findFirst.mock.calls[0][0];
    expect(query.select.payload).toBeUndefined();
    expect(query.select.reviews.select.authorId).toBeUndefined();
  });

  it('prevents publishers from inflating their own install count', async () => {
    const tx = {
      $executeRaw: jest.fn(),
      marketplaceItem: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'item-1',
          organizationId: 'publisher-org',
          priceUsd: 0,
        }),
      },
      marketplacePurchase: { findFirst: jest.fn(), create: jest.fn() },
    };
    const prisma = {
      $transaction: jest.fn((callback) => callback(tx)),
    };
    const service = new MarketService(prisma as any, {} as any);

    await expect(service.purchase('publisher-org', 'user-1', 'item-1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(tx.marketplacePurchase.create).not.toHaveBeenCalled();
  });
});
