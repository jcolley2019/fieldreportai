// Stripe price configuration
// NOTE: These are TEST MODE price IDs. Update to live price IDs for production.
export const STRIPE_PRICES = {
  pro: {
    monthly: {
      priceId: "price_1SZOPAGsHdNVicmjmTZxpwwf",
      amount: 49,
    },
    annual: {
      priceId: "price_1SZPVwGsHdNVicmjY7uO3cE6",
      amount: 468, // $39/month billed annually
    },
    name: "Pro",
  },
  premium: {
    monthly: {
      priceId: "price_1SZOQpGsHdNVicmj0K3ZiwBr",
      amount: 99,
    },
    annual: {
      priceId: "price_1SZPYOGsHdNVicmj7sUaJd38",
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
