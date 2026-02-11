import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[LINK-SUBSCRIPTION] ${step}${detailsStr}`);
};

// Price ID to plan mapping
// TODO: Add live price ID mappings for March 1st 2026 launch
const PRICE_TO_PLAN: Record<string, string> = {
  // "price_LIVE_PRO_ID": "pro",
  // "price_LIVE_PREMIUM_ID": "premium",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    logStep("Function started");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id, email: user.email });

    const { sessionId } = await req.json();
    if (!sessionId) throw new Error("Checkout session ID is required");
    logStep("Session ID received", { sessionId });

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    // Retrieve the checkout session
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription', 'customer'],
    });
    logStep("Checkout session retrieved", { 
      customerId: session.customer,
      subscriptionId: session.subscription
    });

    if (!session.customer) {
      throw new Error("No customer found in checkout session");
    }

    const customerId = typeof session.customer === 'string' 
      ? session.customer 
      : session.customer.id;

    // Update the Stripe customer with the user's email (to link accounts)
    await stripe.customers.update(customerId, {
      email: user.email,
      metadata: {
        supabase_user_id: user.id,
      },
    });
    logStep("Stripe customer updated with user email", { customerId, email: user.email });

    // Get subscription details
    let plan = "pro";
    if (session.subscription) {
      const subscription = typeof session.subscription === 'string'
        ? await stripe.subscriptions.retrieve(session.subscription)
        : session.subscription;
      
      const priceId = subscription.items?.data?.[0]?.price?.id;
      plan = priceId ? (PRICE_TO_PLAN[priceId] || "pro") : "pro";
      logStep("Subscription plan determined", { priceId, plan });
    }

    // Update the user's profile with the plan
    const { error: updateError } = await supabaseClient
      .from('profiles')
      .update({ current_plan: plan })
      .eq('id', user.id);

    if (updateError) {
      logStep("Warning: Failed to update profile", { error: updateError.message });
    } else {
      logStep("Profile updated with plan", { plan });
    }

    return new Response(JSON.stringify({
      success: true,
      plan,
      customerId,
    }), {
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
