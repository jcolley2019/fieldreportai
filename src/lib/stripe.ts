// Stripe price configuration
export const STRIPE_PRICES = {
  pro: {
    priceId: "price_1SZP0N2cM0XKZQKCwlByTPau",
    monthlyAmount: 49,
    name: "Pro",
  },
  premium: {
    priceId: "price_1SZP3L2cM0XKZQKCUpYyo0OK",
    monthlyAmount: 99,
    name: "Premium",
  },
} as const;

export type StripePlanKey = keyof typeof STRIPE_PRICES;
