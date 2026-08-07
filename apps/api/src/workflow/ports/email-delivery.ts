export const EMAIL_DELIVERY = Symbol('EMAIL_DELIVERY');

export interface EmailDeliveryRequest {
  organizationId: string;
  workflowId: string;
  runId: string;
  to: string;
  subject: string;
  body: string;
}

export interface EmailDeliveryReceipt {
  provider: string;
  messageId: string;
}

export interface EmailDelivery {
  send(request: EmailDeliveryRequest): Promise<EmailDeliveryReceipt>;
}
