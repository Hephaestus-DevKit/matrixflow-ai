export const PAYMENT_PROVIDER = Symbol('PAYMENT_PROVIDER');

export interface CheckoutRequest {
  organizationId: string;
  planId: string;
  interval: 'month' | 'year';
  amountUsd: number;
}

export interface CheckoutSession {
  provider: string;
  sessionId: string;
  checkoutUrl: string;
}

export interface PaymentProvider {
  createCheckout(request: CheckoutRequest): Promise<CheckoutSession>;
}
