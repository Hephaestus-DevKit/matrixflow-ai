import { NotFoundException } from '@nestjs/common';
import { CrmService } from '../src/crm/crm.service';

describe('CrmService tenant isolation', () => {
  it('does not create a message when the conversation belongs to another organization', async () => {
    const tx = {
      conversation: { findFirst: jest.fn().mockResolvedValue(null), update: jest.fn() },
      message: { create: jest.fn() },
    };
    const prisma = { $transaction: jest.fn((callback) => callback(tx)) };
    const service = new CrmService(prisma as any, {} as any);

    await expect(
      service.sendMessage('org-a', '87e4cd83-c6d6-4f88-b796-50e381df34ed', { content: 'hello' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(tx.conversation.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ organizationId: 'org-a' }) }),
    );
    expect(tx.message.create).not.toHaveBeenCalled();
  });

  it('rejects leads that reference another organization customer', async () => {
    const prisma = {
      customer: { findFirst: jest.fn().mockResolvedValue(null) },
      lead: { create: jest.fn() },
    };
    const service = new CrmService(prisma as any, {} as any);

    await expect(
      service.createLead('org-a', {
        customerId: '87e4cd83-c6d6-4f88-b796-50e381df34ed',
        score: 10,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.lead.create).not.toHaveBeenCalled();
  });
});
