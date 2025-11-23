import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Camera, FileText, Clock, Users, Shield, Zap, ArrowRight, Star, Play } from "lucide-react";
import { Link } from "react-router-dom";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import logo from "@/assets/field-report-ai-logo.png";

const Landing = () => {
  const features = [
    {
      icon: <FileText className="h-8 w-8" />,
      title: "AI Field Report Generator",
      description: "Daily reports, progress updates, and safety docs generated instantly from your voice notes and media.",
    },
    {
      icon: <Check className="h-8 w-8" />,
      title: "AI Checklist Creator",
      description: "Converts voice notes into structured, actionable tasks with automatic organization.",
    },
    {
      icon: <Camera className="h-8 w-8" />,
      title: "Media Capture",
      description: "Photos, videos, and voice notes with auto-transcription and intelligent tagging.",
    },
    {
      icon: <Users className="h-8 w-8" />,
      title: "Collaboration Tools",
      description: "Share links, comments, PDF export, and real-time team updates.",
    },
    {
      icon: <Shield className="h-8 w-8" />,
      title: "Project Workspace",
      description: "Organize reports and media by job with secure cloud storage.",
    },
  ];

  const steps = [
    {
      icon: <Camera className="h-12 w-12" />,
      title: "Capture",
      description: "Take photos, videos, or voice notes on-site",
    },
    {
      icon: <Zap className="h-12 w-12" />,
      title: "Generate",
      description: "AI creates professional reports and checklists",
    },
    {
      icon: <Users className="h-12 w-12" />,
      title: "Share",
      description: "Distribute instantly to your team",
    },
  ];

  const stats = [
    { value: "10x", label: "Faster Report Creation" },
    { value: "95%", label: "Time Saved on Documentation" },
    { value: "100%", label: "Accurate AI Transcription" },
  ];

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
      cta: "Get Started Free",
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
      cta: "Start Pro Plan Today",
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
      cta: "Get Premium",
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

  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "annual">("monthly");

  const testimonials = [
    {
      name: "Mike Johnson",
      role: "Project Manager",
      company: "BuildCo Construction",
      content: "Field Report AI cut our daily reporting time from 2 hours to 10 minutes. Game changer for our team.",
      rating: 5,
    },
    {
      name: "Sarah Chen",
      role: "Safety Inspector",
      company: "SafeWork Ltd",
      content: "The AI checklist feature ensures we never miss critical safety items. Incredibly reliable.",
      rating: 5,
    },
    {
      name: "David Martinez",
      role: "Site Foreman",
      company: "Premier Builders",
      content: "Voice-to-report is brilliant. I can document while walking the site. No more paperwork after hours.",
      rating: 5,
    },
  ];

  const integrations = [
    { name: "Procore", logo: "🏗️" },
    { name: "PlanGrid", logo: "📐" },
    { name: "Autodesk", logo: "🔧" },
    { name: "Google Drive", logo: "📁" },
    { name: "Dropbox", logo: "📦" },
    { name: "Microsoft 365", logo: "📊" },
  ];

  const faqs = [
    {
      question: "How does the AI generate reports?",
      answer: "Our AI analyzes your voice notes, photos, and videos to extract key information and automatically generates professional field reports following industry standards.",
    },
    {
      question: "Can I customize report templates?",
      answer: "Yes! Pro and Enterprise users can create custom templates that match your company's specific reporting requirements.",
    },
    {
      question: "Is my data secure?",
      answer: "Absolutely. We use bank-level encryption, secure cloud storage, and comply with industry security standards including SOC 2 Type II.",
    },
    {
      question: "Does it work offline?",
      answer: "Yes, you can capture media and voice notes offline. Reports will be generated automatically when you reconnect.",
    },
    {
      question: "How accurate is the voice transcription?",
      answer: "Our AI achieves 100% accuracy with clear audio and handles construction terminology, technical jargon, and industry-specific language.",
    },
    {
      question: "Can I export reports to other formats?",
      answer: "Yes, you can export to PDF, Word Doc, or share via link. Enterprise users get additional export formats and API access.",
    },
  ];

  return (
    <div className="min-h-screen bg-background dark">
      {/* Header */}
      <header className="border-b border-border sticky top-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logo} alt="Field Report AI" className="h-16 w-auto" />
            <span className="font-bold text-xl text-white">Field Report AI</span>
          </div>
          <nav className="hidden md:flex items-center gap-6">
            <a href="#features" className="text-sm text-foreground/80 hover:text-foreground">Features</a>
            <a href="#pricing" className="text-sm text-foreground/80 hover:text-foreground">Pricing</a>
            <a href="#faq" className="text-sm text-foreground/80 hover:text-foreground">FAQ</a>
            <Link to="/auth">
              <Button variant="secondary" size="sm" className="border-2 border-primary font-bold">Sign In</Button>
            </Link>
            <Link to="/auth">
              <Button size="sm">Get Started Free</Button>
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 md:py-32 bg-gradient-to-b from-background via-background to-primary/5 relative overflow-hidden">
        {/* Decorative Background Elements */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute top-20 left-10 w-64 h-64 bg-primary rounded-full blur-3xl"></div>
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-primary rounded-full blur-3xl"></div>
        </div>
        
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-4xl mx-auto text-center">
            {/* Logo Display */}
            <div className="mb-8 flex justify-center">
              <img src={logo} alt="Field Report AI" className="h-32 w-auto" />
            </div>
            
            <div className="flex items-center justify-center gap-2 mb-6">
              <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">
                <Camera className="h-3 w-3 mr-1" />
                Built for Construction Teams
              </Badge>
              <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">
                <Zap className="h-3 w-3 mr-1" />
                AI-Powered Documentation
              </Badge>
            </div>
            
            <h1 className="text-4xl md:text-6xl font-bold mb-6 text-white">
              Create Field Reports <span className="text-primary">10× Faster</span> With AI
            </h1>
            
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Capture photos, videos, and voice notes—Field Report AI instantly turns them into professional reports and structured checklists.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
              <Link to="/auth">
                <Button size="lg" className="gap-2 shadow-lg shadow-primary/20">
                  Get Started Free <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Button size="lg" variant="secondary" className="gap-2 border-2 border-primary font-bold hover:bg-primary/10">
                <Play className="h-4 w-4" /> Watch Demo
              </Button>
            </div>
            
            <div className="grid grid-cols-3 gap-8 max-w-2xl mx-auto">
              {stats.map((stat, index) => (
                <div key={index} className="text-center p-4 rounded-lg bg-primary/5 border border-primary/10">
                  <div className="text-3xl font-bold text-primary mb-1">{stat.value}</div>
                  <div className="text-sm text-muted-foreground">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Pain Points */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-white">Field Reporting Is Broken</h2>
            <p className="text-muted-foreground">Traditional methods waste time and create inefficiencies</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
            {[
              "Manual reports take hours",
              "Scattered photos and notes",
              "Inconsistent formatting",
              "Missed issues and delays",
            ].map((pain, index) => (
              <Card key={index} className="text-center border-destructive/50">
                <CardContent className="pt-6">
                  <p className="text-muted-foreground">{pain}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-white">Field Reporting Made Simple</h2>
            <p className="text-muted-foreground">Three steps to professional documentation</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {steps.map((step, index) => (
              <div key={index} className="text-center group">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/10 border-2 border-primary/20 text-primary mb-4 group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-300 group-hover:scale-110">
                  {step.icon}
                </div>
                <h3 className="text-xl font-semibold mb-2 text-white">{step.title}</h3>
                <p className="text-muted-foreground">{step.description}</p>
                {index < steps.length - 1 && (
                  <ArrowRight className="h-6 w-6 text-primary/40 mx-auto mt-6 hidden md:block" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-white">Everything You Need to Document Your Job Site</h2>
            <p className="text-muted-foreground">Powerful features designed for field professionals</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {features.map((feature, index) => (
              <Card key={index} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-primary/10 text-primary mb-4">
                    {feature.icon}
                  </div>
                  <CardTitle>{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription>{feature.description}</CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Social Proof */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-white">Trusted by Construction Teams</h2>
            <p className="text-muted-foreground">See what professionals are saying</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {testimonials.map((testimonial, index) => (
              <Card key={index}>
                <CardHeader>
                  <div className="flex gap-1 mb-2">
                    {[...Array(testimonial.rating)].map((_, i) => (
                      <Star key={i} className="h-4 w-4 fill-primary text-primary" />
                    ))}
                  </div>
                  <CardDescription className="text-base">"{testimonial.content}"</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="font-semibold">{testimonial.name}</div>
                  <div className="text-sm text-muted-foreground">{testimonial.role}</div>
                  <div className="text-sm text-muted-foreground">{testimonial.company}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20 bg-muted/30">
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
          <div className="grid md:grid-cols-4 gap-6 max-w-6xl mx-auto">
            {pricingPlans.map((plan, index) => {
              const displayPrice = billingPeriod === "monthly" ? plan.monthlyPrice : plan.annualPrice;
              return (
                <Card key={index} className={plan.popular ? "border-primary shadow-lg" : ""}>
                  {plan.popular && (
                    <div className="bg-primary text-primary-foreground text-center py-2 text-sm font-semibold">
                      Most Popular
                    </div>
                  )}
                  <CardHeader>
                    <CardTitle>{plan.name}</CardTitle>
                    <CardDescription>{plan.description}</CardDescription>
                    <div className="mt-4">
                      <span className="text-4xl font-bold">{displayPrice}</span>
                      <span className="text-muted-foreground">{plan.period}</span>
                      {billingPeriod === "annual" && plan.period && (
                        <div className="text-sm text-muted-foreground mt-1">
                          Billed annually
                        </div>
                      )}
                      {plan.period && (
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
                  <CardContent>
                    <h3 className="font-semibold text-sm mb-3">Key Features</h3>
                    <ul className="space-y-3 mb-6">
                      {plan.features.map((feature, i) => (
                        <li key={i} className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-primary" />
                          <span className="text-sm">{feature}</span>
                        </li>
                      ))}
                    </ul>
                    <Link to="/auth">
                      <Button className="w-full" variant={plan.popular ? "default" : "outline"}>
                        {plan.cta}
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Comparison Table */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-white">Why Choose Field Report AI?</h2>
          </div>
          <div className="max-w-4xl mx-auto overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-primary/50">
                  <th className="text-left py-4 px-4 text-foreground font-bold text-base">Feature</th>
                  <th className="text-center py-4 px-4 text-foreground font-bold text-base">Field Report AI</th>
                  <th className="text-center py-4 px-4 text-foreground font-bold text-base">Traditional Methods</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { feature: "Report Generation Time", us: "10 minutes", them: "2+ hours" },
                  { feature: "Voice-to-Text", us: "✓", them: "✗" },
                  { feature: "AI-Powered Insights", us: "✓", them: "✗" },
                  { feature: "Media Organization", us: "Automatic", them: "Manual" },
                  { feature: "Team Collaboration", us: "Real-time", them: "Email chains" },
                  { feature: "Mobile-First", us: "✓", them: "Limited" },
                ].map((row, index) => (
                  <tr key={index} className="border-b border-border/50">
                    <td className="py-4 px-4 font-semibold text-foreground">{row.feature}</td>
                    <td className="py-4 px-4 text-center text-primary font-bold text-lg">{row.us}</td>
                    <td className="py-4 px-4 text-center text-foreground/70 font-medium">{row.them}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Integrations */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-white">Integrates With Your Tools</h2>
            <p className="text-muted-foreground">Connect with the platforms you already use</p>
          </div>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-8 max-w-4xl mx-auto">
            {integrations.map((integration, index) => (
              <div key={index} className="flex flex-col items-center gap-2">
                <div className="text-4xl">{integration.logo}</div>
                <div className="text-sm text-muted-foreground">{integration.name}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Security */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <Card>
              <CardHeader className="text-center">
                <Shield className="h-12 w-12 text-primary mx-auto mb-4" />
                <CardTitle className="text-2xl text-white">Enterprise-Grade Security & Privacy</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-3 gap-6 text-center">
                  <div>
                    <h3 className="font-semibold mb-2">Bank-Level Encryption</h3>
                    <p className="text-sm text-muted-foreground">256-bit SSL encryption for all data</p>
                  </div>
                  <div>
                    <h3 className="font-semibold mb-2">SOC 2 Compliant</h3>
                    <p className="text-sm text-muted-foreground">Regular security audits</p>
                  </div>
                  <div>
                    <h3 className="font-semibold mb-2">GDPR Ready</h3>
                    <p className="text-sm text-muted-foreground">Full data privacy compliance</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-white">Frequently Asked Questions</h2>
          </div>
          <div className="max-w-3xl mx-auto">
            <Accordion type="single" collapsible className="space-y-4">
              {faqs.map((faq, index) => (
                <AccordionItem key={index} value={`item-${index}`} className="border-2 border-border/80 rounded-lg px-6 bg-card">
                  <AccordionTrigger className="text-left font-bold text-base text-foreground hover:text-primary">{faq.question}</AccordionTrigger>
                  <AccordionContent className="text-foreground/90 font-medium text-base leading-relaxed">{faq.answer}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 bg-gradient-to-b from-background to-muted/20">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl md:text-5xl font-bold mb-6 text-white">Ready to Build Smarter?</h2>
            <p className="text-xl text-muted-foreground mb-8">
              Join thousands of construction professionals using Field Report AI
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link to="/auth">
                <Button size="lg" className="gap-2">
                  Get Started Free <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Button size="lg" variant="secondary" className="border-2 border-primary font-bold">Book a Demo</Button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-muted/30 py-12">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <FileText className="h-5 w-5 text-primary" />
                <span className="font-bold">Field Report AI</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Professional field reporting powered by AI
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-4 text-white">Product</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#features" className="hover:text-foreground">Features</a></li>
                <li><a href="#pricing" className="hover:text-foreground">Pricing</a></li>
                <li><a href="#" className="hover:text-foreground">Demo</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4 text-white">Company</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground">About</a></li>
                <li><a href="#" className="hover:text-foreground">Contact</a></li>
                <li><a href="#" className="hover:text-foreground">Careers</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4 text-white">Legal</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground">Privacy Policy</a></li>
                <li><a href="#" className="hover:text-foreground">Terms of Service</a></li>
                <li><a href="#" className="hover:text-foreground">Security</a></li>
              </ul>
            </div>
          </div>
          <div className="pt-8 border-t border-border text-center text-sm text-muted-foreground">
            <p>© 2024 Field Report AI. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
