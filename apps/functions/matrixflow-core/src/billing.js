import { createHmac, timingSafeEqual } from 'node:crypto';

export function billingSignature(rawBody, secret) {
  return createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');
}

export function isValidBillingSignature(rawBody, provided, secret) {
  if (!secret || typeof provided !== 'string') return false;
  const normalized = provided
    .replace(/^sha256=/i, '')
    .trim()
    .toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(normalized)) return false;
  const expected = billingSignature(rawBody, secret);
  return timingSafeEqual(Buffer.from(normalized, 'utf8'), Buffer.from(expected, 'utf8'));
}
