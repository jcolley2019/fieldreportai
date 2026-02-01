import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { PricingSection } from "@/components/PricingSection";
import { EmailCaptureForm } from "@/components/EmailCaptureForm";
import logo from "@/assets/field-report-ai-logo.png";
import { useState, useEffect } from "react";

const Pricing = () => {
  const [searchParams] = useSearchParams();
  const pendingPlan = searchParams.get("plan") as 'pro' | 'premium' | null;
  const pendingBilling = searchParams.get("billing") as 'monthly' | 'annual' | null;
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "annual">(pendingBilling || "monthly");

  return (
    <div className="dark min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      {/* Header */}
      <header className="border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-2">
          <div className="flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2">
              <img src={logo} alt="Field Report AI" className="h-14 w-auto" />
              <span className="text-lg font-bold text-foreground">Field Report AI</span>
            </Link>
            <nav className="hidden md:flex items-center gap-6">
              <a href="/#features" className="text-sm text-foreground/80 hover:text-foreground transition-colors">
                Features
              </a>
              <a href="#faq" className="text-sm text-foreground/80 hover:text-foreground transition-colors">
                FAQ
              </a>
              <Link to="/">
                <Button variant="outline" className="gap-2 border-primary/30 text-foreground hover:border-primary hover:bg-primary/10">
                  <ArrowLeft className="h-4 w-4" />
                  Back to Home
                </Button>
              </Link>
            </nav>
            {/* Mobile menu - just the back button */}
            <Link to="/" className="md:hidden">
              <Button variant="outline" size="sm" className="gap-2 border-primary/30 text-foreground hover:border-primary hover:bg-primary/10">
                <ArrowLeft className="h-4 w-4" />
                Home
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-4 pb-0 bg-transparent animate-fade-in">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-2 text-white">
            Choose Your Perfect Plan
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Start with a 14-day free trial. No credit card required. Upgrade, downgrade, or cancel anytime.
          </p>
        </div>
      </section>

      {/* Billing Period Toggle */}
      <div className="max-w-4xl mx-auto text-center py-8">
        <div className="inline-flex items-center gap-1 p-1 bg-muted rounded-lg">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setBillingPeriod("monthly")}
            className={`relative ${billingPeriod === "monthly" ? "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground" : ""}`}
          >
            Monthly
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setBillingPeriod("annual")}
            className={`relative ${billingPeriod === "annual" ? "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground" : ""}`}
          >
            Annual
            <Badge className="ml-2 bg-primary text-primary-foreground">Save 20%</Badge>
          </Button>
        </div>
      </div>

      {/* Pricing Section */}
      <PricingSection showHeader={false} billingPeriod={billingPeriod} pendingPlan={pendingPlan} />

      {/* FAQ Section */}
      <section id="faq" className="py-12 bg-transparent">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl font-bold text-center mb-8 text-white">Frequently Asked Questions</h2>
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold mb-2 text-white">Can I switch plans later?</h3>
                <p className="text-muted-foreground">
                  Yes! You can upgrade or downgrade your plan at any time. Changes take effect immediately, and we'll prorate your billing accordingly.
                </p>
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-2 text-white">What payment methods do you accept?</h3>
                <p className="text-muted-foreground">
                  We accept all major credit cards (Visa, MasterCard, American Express) and support multiple currencies.
                </p>
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-2 text-white">Is there a long-term contract?</h3>
                <p className="text-muted-foreground">
                  No! All plans are billed monthly or annually with no long-term commitment. You can cancel anytime.
                </p>
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-2 text-white">What happens after the 14-day trial?</h3>
                <p className="text-muted-foreground">
                  After your trial ends, you'll be automatically enrolled in the plan you selected. You can cancel before the trial ends with no charges.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-12 bg-transparent">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-3 text-white">Ready to Get Started?</h2>
          <p className="text-xl text-muted-foreground mb-6 max-w-2xl mx-auto">
            Join thousands of field professionals using Field Report AI to save time and improve documentation.
          </p>
          <div className="max-w-md mx-auto mb-6">
            <EmailCaptureForm 
              source="pricing_page"
              placeholder="Enter your work email"
              buttonText="Start Free Trial"
              className="flex-col sm:flex-row"
            />
          </div>
          <p className="text-sm text-muted-foreground">
            No credit card required • 14-day free trial
          </p>
        </div>
      </section>
    </div>
  );
};

export default Pricing;
