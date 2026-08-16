import {
  HttpError,
  TABLES,
  createRow,
  deleteOwned,
  getOwned,
  recordAudit,
  requireCapability,
} from '../runtime.js';
import { crmReply } from '../features.js';
import { parse, schemas } from '../schemas.js';

export async function handleCrmRoute({ services, context, membership, segments, method, body }) {
  if (method === 'POST' && segments.length === 2 && segments[1] === 'customers') {
    requireCapability(membership, 'crm.manage');
    const input = parse(schemas.customer, body);
    const customer = await createRow(services, TABLES.customers, context.teamId, {
      ...input,
      stage: 'prospect',
      tags: [],
      notes: [],
    });
    try {
      await createRow(services, TABLES.conversations, context.teamId, {
        customerId: customer.id,
        channel: 'internal',
        status: 'open',
        summary: '手动创建的内部对话',
      });
      await recordAudit(services, context, 'crm.customer_created', 'customer', customer.id);
    } catch (error) {
      await deleteOwned(services, TABLES.customers, customer.id, context.teamId).catch(
        () => undefined,
      );
      throw error;
    }
    return customer;
  }

  if (
    method === 'POST' &&
    segments.length === 4 &&
    segments[1] === 'conversations' &&
    segments[2] &&
    segments[3] === 'messages'
  ) {
    requireCapability(membership, 'crm.manage');
    await getOwned(services, TABLES.conversations, segments[2], context.teamId);
    const input = parse(schemas.message, body);
    const message = await createRow(services, TABLES.messages, context.teamId, {
      conversationId: segments[2],
      ...input,
    });
    await recordAudit(services, context, 'crm.message_added', 'conversation', segments[2]);
    return message;
  }

  if (
    method === 'POST' &&
    segments.length === 4 &&
    segments[1] === 'conversations' &&
    segments[2] &&
    segments[3] === 'ai-reply'
  ) {
    requireCapability(membership, 'crm.manage');
    return crmReply(services, context, { conversationId: segments[2] });
  }

  throw new HttpError('函数路由不存在', 404, 'ROUTE_NOT_FOUND');
}
