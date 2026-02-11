// Stripe price configuration
// NOTE: Price IDs removed until March 1st 2026 launch. Do NOT add IDs before then.
export const STRIPE_PRICES = {
  pro: {
    monthly: {
      priceId: "", // TODO: Add live price ID for March 1st 2026 launch
      amount: 29,
    },
    annual: {
      priceId: "", // TODO: Add live price ID for March 1st 2026 launch
      amount: 24,
    },
    name: "Pro",
  },
  premium: {
    monthly: {
      priceId: "", // TODO: Add live price ID for March 1st 2026 launch
      amount: 79,
    },
    annual: {
      priceId: "", // TODO: Add live price ID for March 1st 2026 launch
      amount: 64,
    },
    name: "Premium",
  },
} as const;

export type StripePlanKey = keyof typeof STRIPE_PRICES;
export type BillingPeriod = 'monthly' | 'annual';

export const getPriceId = (plan: StripePlanKey, billingPeriod: BillingPeriod): string => {
  return STRIPE_PRICES[plan][billingPeriod].priceId;
};
