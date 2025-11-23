import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, ArrowLeft } from "lucide-react";

const Pricing = () => {
  const navigate = useNavigate();
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "annual">("monthly");

  const pricingPlans = [
    {
      name: "Basic",
      monthlyPrice: "$0",
      annualPrice: "$0",
      period: "/month",
      description: "Perfect for getting started",
      features: [
        "6 projects",
        "Limited reports & checklists",
        "Basic media capture",
        "Voice transcription",
        "PDF export",
        "Email support",
      ],
      cta: "Current Plan",
      popular: false,
      current: true,
    },
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
        "Custom templates",
      ],
      cta: "Start Pro Plan 14-day Trial",
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
        "Unlimited Photo Storage",
        "PDF Reports",
        "5-Minute Video Capture",
      ],
      cta: "Upgrade to Pro",
      popular: true,
      savings: "20",
    },
    {
      name: "Premium",
      monthlyPrice: "$99",
      annualPrice: "$79",
      period: "/month",
      description: "For growing teams and businesses",
      features: [
        "Everything in Pro",
        "Advanced analytics & reporting",
        "Custom branding",
        "API access",
        "10-minute Video Capture",
        "Project Templates",
        "Report Templates",
        "Company Dashboard",
      ],
      cta: "Upgrade to Premium",
      popular: false,
      savings: "20",
    },
    {
      name: "Enterprise",
      monthlyPrice: "Custom",
      annualPrice: "Custom",
      period: "",
      description: "For large teams and organizations",
      features: [
        "Everything in Premium",
        "Custom integrations",
        "Dedicated support",
        "Advanced security",
        "Training & onboarding",
        "SLA guarantee",
      ],
      cta: "Contact Sales",
      popular: false,
    },
  ];

  return (
    <div className="dark min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/dashboard")}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Button>
          <h1 className="text-xl font-bold text-white">Choose Your Plan</h1>
          <div className="w-[120px]"></div> {/* Spacer for centering */}
        </div>
      </header>

      {/* Pricing Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center mb-8">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-white">Simple, Transparent Pricing</h2>
            <p className="text-muted-foreground mb-8">Choose the plan that fits your needs</p>
            
            {/* Billing Period Toggle */}
            <div className="inline-flex items-center gap-1 p-1 bg-muted rounded-lg">
              <Button
                variant={billingPeriod === "monthly" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setBillingPeriod("monthly")}
                className="relative"
              >
                Monthly
              </Button>
              <Button
                variant={billingPeriod === "annual" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setBillingPeriod("annual")}
                className="relative"
              >
                Annual
                <Badge className="ml-2 bg-primary text-primary-foreground">Save 20%</Badge>
              </Button>
            </div>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
            {pricingPlans.map((plan, index) => {
              const displayPrice = billingPeriod === "monthly" ? plan.monthlyPrice : plan.annualPrice;
              return (
                <Card 
                  key={index} 
                  className={`${plan.popular ? "border-primary shadow-lg" : ""} ${plan.current ? "border-primary/50 bg-primary/5" : ""}`}
                >
                  {plan.popular && (
                    <div className="bg-primary text-primary-foreground text-center py-2 text-sm font-semibold">
                      Most Popular
                    </div>
                  )}
                  {plan.current && (
                    <div className="bg-primary/20 text-primary text-center py-2 text-sm font-semibold">
                      Your Current Plan
                    </div>
                  )}
                  <CardHeader>
                    <CardTitle className="text-foreground">{plan.name}</CardTitle>
                    <CardDescription className="text-muted-foreground">{plan.description}</CardDescription>
                    <div className="mt-4">
                      <span className="text-4xl font-bold text-foreground">{displayPrice}</span>
                      {plan.period && <span className="text-muted-foreground">{plan.period}</span>}
                      {billingPeriod === "annual" && plan.savings && (
                        <Badge className="ml-2 bg-primary/20 text-primary">Save {plan.savings}%</Badge>
                      )}
                    </div>
                    {plan.name === "Pro" || plan.name === "Premium" ? (
                      <p className="text-xs text-muted-foreground mt-2">Includes 3 users · $19/each additional user per month</p>
                    ) : null}
                  </CardHeader>
                  <CardContent>
                    <p className="font-semibold text-foreground mb-3">Key Features:</p>
                    <ul className="space-y-2 mb-6">
                      {plan.features.map((feature, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                          <span className="text-muted-foreground">{feature}</span>
                        </li>
                      ))}
                    </ul>
                    <Button 
                      className="w-full" 
                      variant={plan.current ? "secondary" : plan.popular ? "default" : "outline"}
                      disabled={plan.current}
                    >
                      {plan.cta}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
          
          {/* Additional Info */}
          <div className="max-w-4xl mx-auto mt-12 text-center">
            <p className="text-muted-foreground mb-4">
              All plans include 14-day money-back guarantee. No credit card required for trial.
            </p>
            <p className="text-sm text-muted-foreground">
              Questions? <a href="mailto:support@fieldreportai.com" className="text-primary hover:underline">Contact our sales team</a>
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Pricing;
