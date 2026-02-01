import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CHECK-SUBSCRIPTION] ${step}${detailsStr}`);
};

// Price ID to plan mapping (TEST MODE price IDs)
// NOTE: Update these to live price IDs for production
const PRICE_TO_PLAN: Record<string, string> = {
  // $1 Test prices
  "price_1Sw6tQ2cM0XKZQKCq1umVb9p": "pro",      // $1 Pro Plan (monthly & annual)
  "price_1Sw6tx2cM0XKZQKC3prvNFZp": "premium",  // $1 Premium Plan (monthly & annual)
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

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");
    logStep("Stripe key verified");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");
    logStep("Authorization header found");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id, email: user.email });

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    
    if (customers.data.length === 0) {
      logStep("No customer found, returning unsubscribed state");
      return new Response(JSON.stringify({ 
        subscribed: false,
        plan: null,
        subscription_end: null 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const customerId = customers.data[0].id;
    logStep("Found Stripe customer", { customerId });

    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "active",
      limit: 1,
    });

    const hasActiveSub = subscriptions.data.length > 0;
    let plan = null;
    let subscriptionEnd = null;

    if (hasActiveSub) {
      const subscription = subscriptions.data[0];
      logStep("Processing subscription", { 
        subscriptionId: subscription.id,
        current_period_end: subscription.current_period_end,
        current_period_end_type: typeof subscription.current_period_end,
        items: subscription.items?.data?.length 
      });
      
      // Safely convert subscription end date with try-catch
      try {
        if (subscription.current_period_end != null) {
          const rawValue = subscription.current_period_end;
          let endTimestamp: number;
          
          if (typeof rawValue === 'number') {
            endTimestamp = rawValue * 1000;
          } else if (typeof rawValue === 'string') {
            endTimestamp = Date.parse(rawValue);
          } else {
            endTimestamp = NaN;
          }
          
          if (!isNaN(endTimestamp) && isFinite(endTimestamp)) {
            const dateObj = new Date(endTimestamp);
            if (dateObj instanceof Date && !isNaN(dateObj.getTime())) {
              subscriptionEnd = dateObj.toISOString();
            }
          }
        }
      } catch (dateError) {
        logStep("Warning: Failed to parse subscription end date", { 
          error: dateError instanceof Error ? dateError.message : String(dateError),
          rawValue: subscription.current_period_end 
        });
      }
      
      const priceId = subscription.items?.data?.[0]?.price?.id;
      plan = priceId ? (PRICE_TO_PLAN[priceId] || "pro") : "pro";
      logStep("Active subscription found", { 
        subscriptionId: subscription.id, 
        priceId,
        plan,
        endDate: subscriptionEnd 
      });

      // Update the user's profile with the current plan
      const { error: updateError } = await supabaseClient
        .from('profiles')
        .update({ current_plan: plan })
        .eq('id', user.id);

      if (updateError) {
        logStep("Warning: Failed to update profile", { error: updateError.message });
      } else {
        logStep("Profile updated with plan", { plan });
      }
    } else {
      logStep("No active subscription found");
    }

    return new Response(JSON.stringify({
      subscribed: hasActiveSub,
      plan,
      subscription_end: subscriptionEnd
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
