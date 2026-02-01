// Stripe price configuration
// NOTE: These are TEST MODE price IDs. Update to live price IDs for production.
export const STRIPE_PRICES = {
  pro: {
    monthly: {
      priceId: "price_1Sw6tQ2cM0XKZQKCq1umVb9p", // TEST: $1 Pro Plan
      amount: 1,
    },
    annual: {
      priceId: "price_1Sw6tQ2cM0XKZQKCq1umVb9p", // TEST: $1 Pro Plan
      amount: 1,
    },
    name: "Pro",
  },
  premium: {
    monthly: {
      priceId: "price_1Sw6tx2cM0XKZQKC3prvNFZp", // TEST: $1 Premium Plan
      amount: 1,
    },
    annual: {
      priceId: "price_1Sw6tx2cM0XKZQKC3prvNFZp", // TEST: $1 Premium Plan
      amount: 1,
    },
    name: "Premium",
  },
} as const;

export type StripePlanKey = keyof typeof STRIPE_PRICES;
export type BillingPeriod = 'monthly' | 'annual';

export const getPriceId = (plan: StripePlanKey, billingPeriod: BillingPeriod): string => {
  return STRIPE_PRICES[plan][billingPeriod].priceId;
};
