import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { getMidCycleUpgradeQuotes } = require('./subscriptionBilling');

describe('mid-cycle subscription upgrades', () => {
  const now = new Date('2026-07-13T00:00:00.000Z');

  it('credits unused Starter time and preserves the renewal date', () => {
    const tenant = {
      plan: 'starter',
      status: 'active',
      currency: 'KES',
      subscriptionEndsAt: new Date('2026-07-28T00:00:00.000Z')
    };
    const quotes = getMidCycleUpgradeQuotes(tenant, now);
    const growth = quotes.find((quote) => quote.targetPlan === 'growth');

    expect(quotes.map((quote) => quote.targetPlan)).toEqual(['growth', 'enterprise']);
    expect(growth.remainingDays).toBe(15);
    expect(growth.unusedCurrentPlanCredit).toBe(1300);
    expect(growth.targetPlanProratedValue).toBe(4550);
    expect(growth.amount).toBe(3250);
    expect(growth.subscriptionEndsAt.toISOString()).toBe('2026-07-28T00:00:00.000Z');
  });

  it('allows Growth to move only to Enterprise', () => {
    const quotes = getMidCycleUpgradeQuotes({
      plan: 'growth',
      status: 'active',
      currency: 'KES',
      subscriptionEndsAt: new Date('2026-08-12T00:00:00.000Z')
    }, now);
    expect(quotes).toHaveLength(1);
    expect(quotes[0]).toMatchObject({ targetPlan: 'enterprise', amount: 5850 });
  });

  it('does not quote inactive or expired subscriptions', () => {
    expect(getMidCycleUpgradeQuotes({ plan: 'starter', status: 'pending_payment' }, now)).toEqual([]);
    expect(getMidCycleUpgradeQuotes({
      plan: 'starter',
      status: 'active',
      subscriptionEndsAt: new Date('2026-07-12T00:00:00.000Z')
    }, now)).toEqual([]);
  });
});
