import { Module } from '@nestjs/common';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { PAYMENT_PROVIDER } from './ports/payment-provider';
import { DisabledPaymentProvider } from './adapters/disabled-payment.provider';

@Module({
  controllers: [BillingController],
  providers: [
    BillingService,
    DisabledPaymentProvider,
    { provide: PAYMENT_PROVIDER, useExisting: DisabledPaymentProvider },
  ],
  exports: [BillingService],
})
export class BillingModule {}
