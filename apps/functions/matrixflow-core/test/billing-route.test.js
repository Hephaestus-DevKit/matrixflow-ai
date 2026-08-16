import test from 'node:test';
import assert from 'node:assert/strict';
import { selectCurrentSubscription } from '../src/routes/billing.js';

test('billing current state surfaces trialing and delinquent subscriptions instead of preview', () => {
  const future = new Date(Date.now() + 86_400_000).toISOString();
  assert.equal(
    selectCurrentSubscription([
      { id: 'old', status: 'canceled', currentPeriodEnd: future },
      { id: 'trial', status: 'trialing', currentPeriodEnd: future },
    ]).id,
    'trial',
  );
  assert.equal(
    selectCurrentSubscription([{ id: 'due', status: 'past_due', currentPeriodEnd: future }]).id,
    'due',
  );
});
