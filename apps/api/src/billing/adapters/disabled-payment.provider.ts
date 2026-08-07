import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import type { CheckoutRequest, CheckoutSession, PaymentProvider } from '../ports/payment-provider';

@Injectable()
export class DisabledPaymentProvider implements PaymentProvider {
  async createCheckout(_request: CheckoutRequest): Promise<CheckoutSession> {
    throw new HttpException(
      'Paid subscription checkout is not configured',
      HttpStatus.PAYMENT_REQUIRED,
    );
  }
}
