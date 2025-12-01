// Stripe price configuration
export const STRIPE_PRICES = {
  pro: {
    priceId: "price_1SZOPAGsHdNVicmjmTZxpwwf",
    monthlyAmount: 49,
    name: "Pro",
  },
  premium: {
    priceId: "price_1SZOQpGsHdNVicmj0K3ZiwBr",
    monthlyAmount: 99,
    name: "Premium",
  },
} as const;

export type StripePlanKey = keyof typeof STRIPE_PRICES;
