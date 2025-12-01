// Stripe price configuration
export const STRIPE_PRICES = {
  pro: {
    monthly: {
      priceId: "price_1SZP0N2cM0XKZQKCwlByTPau",
      amount: 49,
    },
    annual: {
      priceId: "price_1SZP6j2cM0XKZQKCbGlkXO8F",
      amount: 468, // $39/month billed annually
    },
    name: "Pro",
  },
  premium: {
    monthly: {
      priceId: "price_1SZP3L2cM0XKZQKCUpYyo0OK",
      amount: 99,
    },
    annual: {
      priceId: "price_1SZP8V2cM0XKZQKCOgD96dW0",
      amount: 948, // $79/month billed annually
    },
    name: "Premium",
  },
} as const;

export type StripePlanKey = keyof typeof STRIPE_PRICES;
export type BillingPeriod = 'monthly' | 'annual';

export const getPriceId = (plan: StripePlanKey, billingPeriod: BillingPeriod): string => {
  return STRIPE_PRICES[plan][billingPeriod].priceId;
};
