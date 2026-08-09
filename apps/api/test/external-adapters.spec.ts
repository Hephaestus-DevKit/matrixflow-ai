import { HttpException, NotImplementedException } from '@nestjs/common';
import { DisabledPaymentProvider } from '../src/billing/adapters/disabled-payment.provider';
import { DisabledEmailDelivery } from '../src/workflow/adapters/disabled-email.delivery';

describe('disabled external adapters', () => {
  it('fails paid checkout explicitly until a payment provider is configured', async () => {
    const provider = new DisabledPaymentProvider();

    await expect(
      provider.createCheckout({
        organizationId: 'organization',
        planId: 'plan',
        interval: 'month',
        amountUsd: 29,
      }),
    ).rejects.toMatchObject<HttpException>({ status: 402 });
  });

  it('fails email delivery explicitly until a delivery adapter is configured', async () => {
    const delivery = new DisabledEmailDelivery();

    await expect(
      delivery.send({
        organizationId: 'organization',
        workflowId: 'workflow',
        runId: 'run',
        to: 'owner@example.com',
        subject: 'Result',
        body: 'Completed',
      }),
    ).rejects.toBeInstanceOf(NotImplementedException);
  });
});
