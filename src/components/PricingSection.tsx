import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const pricingPlans = [
  {
    name: "Pro Plan 14-day Trial",
    monthlyPrice: "$0",
    annualPrice: "$0",
    period: "",
    description: "Try all Pro features free for 14 days",
    features: [
      "Unlimited reports & checklists",
      "Advanced media capture",
      "AI-powered insights",
      "Team collaboration",
      "Priority support",
      "Unlimited Photo Storage",
      "PDF Reports",
      "5-Minute Video Capture",
    ],
    cta: "Start Trial",
    popular: false,
  },
  {
    name: "Pro",
    monthlyPrice: "$49",
    annualPrice: "$39",
    period: "/month",
    description: "For active field professionals",
    features: [
      "Unlimited reports & checklists",
      "Advanced media capture",
      "AI-powered insights",
      "Team collaboration",
      "Priority support",
      "Unlimited Photo Storage",
      "PDF Reports",
      "5-Minute Video Capture",
    ],
    cta: "Start Plan",
    popular: true,
  },
  {
    name: "Premium",
    monthlyPrice: "$99",
    annualPrice: "$79",
    period: "/month",
    description: "Advanced features for growing teams",
    features: [
      "Everything in Pro",
      "Custom company letterhead",
      "Custom branding",
      "API access",
      "Advanced analytics",
      "Dedicated support",
      "Custom integrations",
      "10-Minute Video Capture",
    ],
    cta: "Start Plan",
    popular: false,
  },
  {
    name: "Enterprise",
    monthlyPrice: "Custom Price Quote",
    annualPrice: "Custom Price Quote",
    period: "",
    description: "For large organizations",
    features: [
      "Everything in Premium",
      "Custom company letterhead",
      "Custom integrations",
      "Dedicated account manager",
      "Advanced security",
      "Custom contract terms",
      "Training & onboarding",
      "SLA guarantee",
    ],
    cta: "Contact Sales",
    popular: false,
  },
];

interface PricingSectionProps {
  showHeader?: boolean;
  billingPeriod?: "monthly" | "annual";
}

export const PricingSection: React.FC<PricingSectionProps> = ({ showHeader = true, billingPeriod: externalBillingPeriod }) => {
  const [internalBillingPeriod, setInternalBillingPeriod] = useState<"monthly" | "annual">("monthly");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const billingPeriod = externalBillingPeriod ?? internalBillingPeriod;

  const handleStartTrial = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        navigate("/auth");
        return;
      }

      // Check if user already has a trial
      const { data: profile } = await supabase
        .from('profiles')
        .select('trial_start_date, current_plan')
        .eq('id', user.id)
        .single();

      if (profile?.trial_start_date) {
        toast.error("You have already used your trial period");
        return;
      }

      // Update profile with trial info
      const { error } = await supabase
        .from('profiles')
        .update({
          trial_start_date: new Date().toISOString(),
          current_plan: 'trial',
        })
        .eq('id', user.id);

      if (error) throw error;

      toast.success("Trial activated! Enjoy 14 days of Pro features");
      navigate("/dashboard");
    } catch (error) {
      console.error('Error activating trial:', error);
      toast.error("Failed to activate trial. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section id="pricing" className="pt-0 pb-8 bg-muted/30">
      <div className="container mx-auto px-4">
        {showHeader && (
          <div className="max-w-4xl mx-auto text-center mb-4">
            <h2 className="text-3xl md:text-4xl font-bold mb-2 text-white">Simple, Transparent Pricing</h2>
            <p className="text-muted-foreground mb-4">Choose the plan that fits your needs</p>
          </div>
        )}
        
        {/* Billing Period Toggle - only show if not controlled externally */}
        {!externalBillingPeriod && (
          <div className="max-w-4xl mx-auto text-center mb-4">
            <div className="inline-flex items-center gap-1 p-1 bg-muted rounded-lg">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setInternalBillingPeriod("monthly")}
                className={`relative ${billingPeriod === "monthly" ? "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground" : ""}`}
              >
                Monthly
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setInternalBillingPeriod("annual")}
                className={`relative ${billingPeriod === "annual" ? "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground" : ""}`}
              >
                Annual
                <Badge className="ml-2 bg-primary text-primary-foreground">Save 20%</Badge>
              </Button>
            </div>
          </div>
        )}

        <div className="grid md:grid-cols-4 gap-6 max-w-6xl mx-auto">
          {pricingPlans.map((plan, index) => {
            const displayPrice = billingPeriod === "monthly" ? plan.monthlyPrice : plan.annualPrice;
            return (
              <Card key={index} className={`flex flex-col ${plan.popular ? "border-primary shadow-lg rounded-tl-none rounded-tr-none" : ""}`}>
                {plan.popular && (
                  <div className="bg-primary text-primary-foreground text-center py-2 text-sm font-semibold">
                    Most Popular
                  </div>
                )}
                <CardHeader>
                  <CardTitle>{plan.name}</CardTitle>
                  <CardDescription>{plan.description}</CardDescription>
                  <div className="mt-4 min-h-[140px]">
                    <span className="text-4xl font-bold">{displayPrice}</span>
                    <span className="text-muted-foreground">{plan.period}</span>
                    <div className="text-sm text-muted-foreground mt-1 h-5">
                      {plan.period && (billingPeriod === "annual" ? "Billed annually" : "Billed monthly")}
                    </div>
                    {plan.name === "Pro Plan 14-day Trial" && (
                      <div className="text-xs text-muted-foreground mt-3 leading-relaxed">
                        This plan will expire in 14 days unless a plan is chosen.
                      </div>
                    )}
                    {plan.period && plan.name !== "Basic" && (
                      <>
                        <div className="text-sm text-foreground mt-2">
                          Includes 3 Users
                        </div>
                        <div className="text-sm text-muted-foreground">
                          $19/each additional user per month
                        </div>
                      </>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col flex-1">
                  <h3 className="font-semibold text-sm mb-3">Key Features</h3>
                  <ul className="space-y-3 mb-6 flex-1">
                    {plan.features.map((feature, i) => (
                      <li key={i} className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-primary" />
                        <span className="text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  {plan.name === "Pro Plan 14-day Trial" ? (
                    <Button 
                      className="w-full" 
                      variant={plan.popular ? "default" : "outline"}
                      onClick={handleStartTrial}
                      disabled={loading}
                    >
                      {loading ? "Activating..." : plan.cta}
                    </Button>
                  ) : plan.name === "Enterprise" ? (
                    <a 
                      href={`mailto:jcolley2019@gmail.com?subject=Enterprise Plan Inquiry&body=Hello,%0D%0A%0D%0AI am interested in the Enterprise plan for Field Report AI.%0D%0A%0D%0APlease provide information about:%0D%0A%0D%0A- Team Size: [Please specify]%0D%0A- Number of Projects per Month: [Please specify]%0D%0A- Required Integrations: [Please specify]%0D%0A- Specific Requirements: [Please describe]%0D%0A- Preferred Start Date: [Please specify]%0D%0A%0D%0AThank you,%0D%0A[Your Name]%0D%0A[Company Name]`}
                      className="w-full"
                    >
                      <Button className="w-full" variant={plan.popular ? "default" : "outline"}>
                        {plan.cta}
                      </Button>
                    </a>
                  ) : (
                    <Link to="/auth">
                      <Button className="w-full" variant={plan.popular ? "default" : "outline"}>
                        {plan.cta}
                      </Button>
                    </Link>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
};
