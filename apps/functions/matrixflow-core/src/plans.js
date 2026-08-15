/**
 * The plan catalog is deliberately kept server-side as the source of truth
 * for limits. The public client may display a copy of this catalog, but it
 * must never be trusted to enforce entitlements.
 */
export const PLAN_CATALOG = Object.freeze([
  {
    id: 'free',
    name: 'Free',
    priceMonthlyUsd: 0,
    priceYearlyUsd: 0,
    seats: 1,
    aiCallsPerMonth: 100,
    aiCallsPerMinute: 20,
    agentLimit: 10,
    contentProjectLimit: 10,
    knowledgeBaseLimit: 5,
    workflowLimit: 3,
  },
  {
    id: 'pro',
    name: 'Pro',
    priceMonthlyUsd: 29,
    priceYearlyUsd: 290,
    seats: 5,
    aiCallsPerMonth: 5_000,
    aiCallsPerMinute: 60,
    agentLimit: 50,
    contentProjectLimit: 50,
    knowledgeBaseLimit: 25,
    workflowLimit: 100,
  },
  {
    id: 'team',
    name: 'Team',
    priceMonthlyUsd: 99,
    priceYearlyUsd: 990,
    seats: 20,
    aiCallsPerMonth: 25_000,
    aiCallsPerMinute: 120,
    agentLimit: 200,
    contentProjectLimit: 200,
    knowledgeBaseLimit: 100,
    workflowLimit: 500,
  },
]);

export const DEFAULT_PLAN_ID = 'free';

export function planById(planId) {
  return PLAN_CATALOG.find((plan) => plan.id === planId) || PLAN_CATALOG[0];
}

export function publicPlanCatalog() {
  return PLAN_CATALOG.map(
    ({ id, name, priceMonthlyUsd, priceYearlyUsd, seats, aiCallsPerMonth, workflowLimit }) => ({
      id,
      name,
      priceMonthlyUsd,
      priceYearlyUsd,
      seats,
      aiCallsPerMonth,
      workflowLimit,
    }),
  );
}
