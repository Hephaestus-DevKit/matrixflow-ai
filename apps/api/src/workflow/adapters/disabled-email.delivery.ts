import { Injectable, NotImplementedException } from '@nestjs/common';
import type {
  EmailDelivery,
  EmailDeliveryReceipt,
  EmailDeliveryRequest,
} from '../ports/email-delivery';

@Injectable()
export class DisabledEmailDelivery implements EmailDelivery {
  async send(_request: EmailDeliveryRequest): Promise<EmailDeliveryReceipt> {
    throw new NotImplementedException('Email workflow nodes require a delivery adapter');
  }
}
