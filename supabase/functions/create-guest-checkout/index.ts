import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-GUEST-CHECKOUT] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const { priceId, plan, billingPeriod } = await req.json();
    if (!priceId) throw new Error("Price ID is required");
    logStep("Price ID received", { priceId, plan, billingPeriod });

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    const origin = req.headers.get("origin") || "https://fieldreportai.lovable.app";
    logStep("Using origin", { origin });
    
    // Create checkout session for guest (no customer ID, will collect email)
    const session = await stripe.checkout.sessions.create({
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: "subscription",
      // After payment, redirect to signup page with session ID to link account
      success_url: `${origin}/checkout-success?session_id={CHECKOUT_SESSION_ID}&plan=${plan}&billing=${billingPeriod}&guest=true`,
      cancel_url: `${origin}/pricing?checkout=cancelled`,
      // Allow customer to enter their email during checkout
      customer_creation: "always",
      // Collect billing address for compliance
      billing_address_collection: "required",
      metadata: {
        plan: plan || "unknown",
        billing_period: billingPeriod || "monthly",
        is_guest: "true",
      },
    });

    logStep("Guest checkout session created", { sessionId: session.id, url: session.url });

    return new Response(JSON.stringify({ url: session.url, sessionId: session.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
