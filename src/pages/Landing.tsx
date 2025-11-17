import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { 
  Camera, 
  Mic, 
  ListChecks, 
  FileText, 
  Zap, 
  Shield, 
  CheckCircle2,
  Star,
  ArrowRight,
  Users,
  TrendingUp,
  Clock,
  ChevronDown,
} from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const Landing = () => {
  const navigate = useNavigate();

  const features = [
    {
      icon: Camera,
      title: "Photo Capture",
      description: "Capture and annotate site photos instantly with intelligent AI-powered categorization"
    },
    {
      icon: Mic,
      title: "Voice Input",
      description: "Dictate notes and reports hands-free with industry-leading speech recognition"
    },
    {
      icon: ListChecks,
      title: "Smart Checklists",
      description: "Create dynamic checklists that adapt to your workflow and ensure compliance"
    },
    {
      icon: FileText,
      title: "Instant Reports",
      description: "Generate professional, branded reports in seconds with customizable templates"
    },
    {
      icon: Zap,
      title: "Lightning Fast",
      description: "Work offline seamlessly and sync automatically when connectivity returns"
    },
    {
      icon: Shield,
      title: "Enterprise Security",
      description: "Bank-level encryption and compliance with SOC 2 and ISO 27001 standards"
    }
  ];

  const stats = [
    { icon: Users, value: "50K+", label: "Active Users" },
    { icon: TrendingUp, value: "98%", label: "Success Rate" },
    { icon: Clock, value: "5hr", label: "Time Saved/Week" },
  ];

  const testimonials = [
    {
      name: "Sarah Mitchell",
      role: "Construction Manager",
      company: "BuildCo",
      content: "FieldReport Pro has transformed our site inspection process. We've cut reporting time by 80% and our team loves it.",
      rating: 5,
    },
    {
      name: "James Chen",
      role: "Safety Officer",
      company: "SafetyFirst Inc",
      content: "The voice input feature is a game-changer. I can document everything while keeping my hands free for inspections.",
      rating: 5,
    },
    {
      name: "Maria Garcia",
      role: "Project Lead",
      company: "Apex Engineering",
      content: "Integration with our existing tools was seamless. The ROI was visible within the first month.",
      rating: 5,
    },
  ];

  const pricingTiers = [
    {
      name: "Starter",
      price: "29",
      description: "Perfect for individuals and small teams",
      features: [
        "Up to 50 reports/month",
        "Photo capture & voice input",
        "5GB cloud storage",
        "Email support",
        "Basic templates"
      ],
      cta: "Start Free Trial",
      highlighted: false,
    },
    {
      name: "Professional",
      price: "79",
      description: "For growing teams and businesses",
      features: [
        "Unlimited reports",
        "Advanced AI features",
        "100GB cloud storage",
        "Priority support",
        "Custom branding",
        "Team collaboration",
        "API access"
      ],
      cta: "Start Free Trial",
      highlighted: true,
    },
    {
      name: "Enterprise",
      price: "Custom",
      description: "For large organizations",
      features: [
        "Everything in Professional",
        "Unlimited storage",
        "Dedicated account manager",
        "SLA guarantee",
        "Custom integrations",
        "Advanced security",
        "On-premise options"
      ],
      cta: "Contact Sales",
      highlighted: false,
    },
  ];

  const faqs = [
    {
      question: "How long is the free trial?",
      answer: "We offer a 14-day free trial with full access to all Professional features. No credit card required to start."
    },
    {
      question: "Can I switch plans later?",
      answer: "Yes! You can upgrade or downgrade your plan at any time. Changes take effect immediately and we'll prorate the difference."
    },
    {
      question: "Is my data secure?",
      answer: "Absolutely. We use bank-level encryption (AES-256) for data at rest and in transit. We're SOC 2 Type II certified and GDPR compliant."
    },
    {
      question: "Do you offer mobile apps?",
      answer: "Yes, we have native iOS and Android apps that work seamlessly with the web platform and support offline functionality."
    },
    {
      question: "What integrations do you support?",
      answer: "We integrate with major platforms including Slack, Teams, Google Drive, Dropbox, and many project management tools. Custom integrations are available on Enterprise plans."
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-lg">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-accent">
              <FileText className="h-5 w-5 text-primary-foreground" />
            </div>
            <h1 className="text-xl font-bold text-foreground">FieldReport Pro</h1>
          </div>
          <div className="hidden items-center gap-8 md:flex">
            <button 
              onClick={() => document.getElementById("features")?.scrollIntoView({ behavior: "smooth" })}
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Features
            </button>
            <button 
              onClick={() => document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth" })}
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Pricing
            </button>
            <button 
              onClick={() => document.getElementById("testimonials")?.scrollIntoView({ behavior: "smooth" })}
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Testimonials
            </button>
          </div>
          <div className="flex gap-3">
            <Button
              variant="ghost"
              onClick={() => navigate("/auth")}
            >
              Sign In
            </Button>
            <Button
              onClick={() => navigate("/auth")}
              className="group"
            >
              Get Started
              <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        {/* Gradient Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-accent/5 to-background" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,hsl(var(--primary)/0.1),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,hsl(var(--accent)/0.1),transparent_50%)]" />
        
        <div className="container relative mx-auto px-4 py-20 md:py-32">
          <div className="mx-auto max-w-4xl text-center">
            <Badge className="mb-6 animate-fade-in bg-primary/10 text-primary hover:bg-primary/20">
              🎉 Trusted by 50,000+ professionals worldwide
            </Badge>
            
            <h2 className="mb-6 animate-fade-in text-5xl font-bold leading-tight text-foreground md:text-7xl [animation-delay:100ms]">
              Field Reporting,
              <br />
              <span className="bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
                Reimagined
              </span>
            </h2>
            
            <p className="mb-8 animate-fade-in text-lg text-muted-foreground md:text-xl [animation-delay:200ms]">
              Create professional site inspection reports in minutes with AI-powered voice input, 
              intelligent photo capture, and smart checklists. Join thousands of teams who've transformed their workflow.
            </p>
            
            <div className="flex flex-col gap-4 sm:flex-row sm:justify-center [animation-delay:300ms] animate-fade-in">
              <Button
                size="lg"
                className="group text-lg shadow-lg shadow-primary/20 transition-shadow hover:shadow-xl hover:shadow-primary/30"
                onClick={() => navigate("/auth")}
              >
                Start Free Trial
                <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="text-lg"
                onClick={() => {
                  document.getElementById("features")?.scrollIntoView({ behavior: "smooth" });
                }}
              >
                Watch Demo
              </Button>
            </div>

            {/* Stats */}
            <div className="mt-16 grid grid-cols-3 gap-8 animate-fade-in [animation-delay:400ms]">
              {stats.map((stat, index) => (
                <div key={index} className="text-center">
                  <div className="mb-2 flex justify-center">
                    <stat.icon className="h-6 w-6 text-primary" />
                  </div>
                  <div className="text-3xl font-bold text-foreground">{stat.value}</div>
                  <div className="text-sm text-muted-foreground">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Scroll Indicator */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
            <ChevronDown className="h-6 w-6 text-muted-foreground" />
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="bg-muted/30 py-20 md:py-32">
        <div className="container mx-auto px-4">
          <div className="mb-16 text-center">
            <Badge className="mb-4 bg-primary/10 text-primary">Features</Badge>
            <h3 className="mb-4 text-4xl font-bold text-foreground md:text-5xl">
              Everything You Need,
              <br />
              <span className="text-primary">Nothing You Don't</span>
            </h3>
            <p className="text-lg text-muted-foreground md:text-xl">
              Powerful features designed to streamline your field operations
            </p>
          </div>
          
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {features.map((feature, index) => (
              <Card
                key={index}
                className="group relative overflow-hidden border-border/50 bg-card p-8 transition-all hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="absolute right-0 top-0 h-32 w-32 -translate-y-16 translate-x-16 rounded-full bg-primary/5 transition-transform group-hover:scale-150" />
                <div className="relative">
                  <div className="mb-6 inline-flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                    <feature.icon className="h-7 w-7" />
                  </div>
                  <h4 className="mb-3 text-xl font-semibold text-foreground">
                    {feature.title}
                  </h4>
                  <p className="text-muted-foreground">
                    {feature.description}
                  </p>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section id="testimonials" className="py-20 md:py-32">
        <div className="container mx-auto px-4">
          <div className="mb-16 text-center">
            <Badge className="mb-4 bg-primary/10 text-primary">Testimonials</Badge>
            <h3 className="mb-4 text-4xl font-bold text-foreground md:text-5xl">
              Loved by Teams
              <br />
              <span className="text-primary">Around the World</span>
            </h3>
            <p className="text-lg text-muted-foreground md:text-xl">
              See what our customers have to say
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {testimonials.map((testimonial, index) => (
              <Card key={index} className="border-border/50 bg-card p-8">
                <div className="mb-4 flex gap-1">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star key={i} className="h-5 w-5 fill-primary text-primary" />
                  ))}
                </div>
                <p className="mb-6 text-card-foreground">
                  "{testimonial.content}"
                </p>
                <div className="border-t border-border pt-4">
                  <div className="font-semibold text-foreground">{testimonial.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {testimonial.role} at {testimonial.company}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="bg-muted/30 py-20 md:py-32">
        <div className="container mx-auto px-4">
          <div className="mb-16 text-center">
            <Badge className="mb-4 bg-primary/10 text-primary">Pricing</Badge>
            <h3 className="mb-4 text-4xl font-bold text-foreground md:text-5xl">
              Simple, Transparent
              <br />
              <span className="text-primary">Pricing</span>
            </h3>
            <p className="text-lg text-muted-foreground md:text-xl">
              Choose the plan that fits your needs
            </p>
          </div>

          <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-3">
            {pricingTiers.map((tier, index) => (
              <Card
                key={index}
                className={`relative overflow-hidden border-2 p-8 ${
                  tier.highlighted
                    ? "border-primary bg-card shadow-xl shadow-primary/10"
                    : "border-border/50 bg-card"
                }`}
              >
                {tier.highlighted && (
                  <Badge className="absolute right-4 top-4 bg-primary text-primary-foreground">
                    Most Popular
                  </Badge>
                )}
                
                <div className="mb-6">
                  <h4 className="mb-2 text-2xl font-bold text-foreground">{tier.name}</h4>
                  <p className="text-sm text-muted-foreground">{tier.description}</p>
                </div>

                <div className="mb-6">
                  <div className="flex items-baseline">
                    {tier.price === "Custom" ? (
                      <span className="text-4xl font-bold text-foreground">Custom</span>
                    ) : (
                      <>
                        <span className="text-5xl font-bold text-foreground">${tier.price}</span>
                        <span className="ml-2 text-muted-foreground">/month</span>
                      </>
                    )}
                  </div>
                </div>

                <Button
                  className={`mb-6 w-full ${tier.highlighted ? "" : "variant-outline"}`}
                  variant={tier.highlighted ? "default" : "outline"}
                  onClick={() => navigate("/auth")}
                >
                  {tier.cta}
                </Button>

                <ul className="space-y-3">
                  {tier.features.map((feature, featureIndex) => (
                    <li key={featureIndex} className="flex items-start gap-3">
                      <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-primary" />
                      <span className="text-sm text-card-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20 md:py-32">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-3xl">
            <div className="mb-16 text-center">
              <Badge className="mb-4 bg-primary/10 text-primary">FAQ</Badge>
              <h3 className="mb-4 text-4xl font-bold text-foreground md:text-5xl">
                Frequently Asked
                <br />
                <span className="text-primary">Questions</span>
              </h3>
            </div>

            <Accordion type="single" collapsible className="w-full">
              {faqs.map((faq, index) => (
                <AccordionItem key={index} value={`item-${index}`} className="border-border">
                  <AccordionTrigger className="text-left text-lg font-medium text-foreground hover:text-primary">
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary to-accent py-20 md:py-32">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0zNiAxOGMzLjMxNCAwIDYgMi42ODYgNiA2cy0yLjY4NiA2LTYgNi02LTIuNjg2LTYtNiAyLjY4Ni02IDYtNnoiIHN0cm9rZT0iI2ZmZiIgc3Ryb2tlLW9wYWNpdHk9Ii4xIi8+PC9nPjwvc3ZnPg==')] opacity-10" />
        
        <div className="container relative mx-auto px-4 text-center">
          <h3 className="mb-6 text-4xl font-bold text-primary-foreground md:text-5xl">
            Ready to Transform Your Workflow?
          </h3>
          <p className="mb-8 text-lg text-primary-foreground/90 md:text-xl">
            Join 50,000+ professionals who trust FieldReport Pro
            <br />
            Start your 14-day free trial today. No credit card required.
          </p>
          <div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
            <Button
              size="lg"
              className="bg-background text-lg text-foreground shadow-xl hover:bg-background/90"
              onClick={() => navigate("/auth")}
            >
              Start Free Trial
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-2 border-primary-foreground bg-transparent text-lg text-primary-foreground hover:bg-primary-foreground/10"
              onClick={() => navigate("/auth")}
            >
              Schedule Demo
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-muted/30 py-12">
        <div className="container mx-auto px-4">
          <div className="grid gap-8 md:grid-cols-4">
            <div>
              <div className="mb-4 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-accent">
                  <FileText className="h-5 w-5 text-primary-foreground" />
                </div>
                <h3 className="text-lg font-bold text-foreground">FieldReport Pro</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Professional field reporting made simple.
              </p>
            </div>

            <div>
              <h4 className="mb-4 font-semibold text-foreground">Product</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><button className="hover:text-primary">Features</button></li>
                <li><button className="hover:text-primary">Pricing</button></li>
                <li><button className="hover:text-primary">Security</button></li>
                <li><button className="hover:text-primary">Roadmap</button></li>
              </ul>
            </div>

            <div>
              <h4 className="mb-4 font-semibold text-foreground">Company</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><button className="hover:text-primary">About</button></li>
                <li><button className="hover:text-primary">Blog</button></li>
                <li><button className="hover:text-primary">Careers</button></li>
                <li><button className="hover:text-primary">Contact</button></li>
              </ul>
            </div>

            <div>
              <h4 className="mb-4 font-semibold text-foreground">Legal</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><button className="hover:text-primary">Privacy</button></li>
                <li><button className="hover:text-primary">Terms</button></li>
                <li><button className="hover:text-primary">Security</button></li>
                <li><button className="hover:text-primary">Compliance</button></li>
              </ul>
            </div>
          </div>

          <div className="mt-12 border-t border-border pt-8 text-center text-sm text-muted-foreground">
            <p>&copy; 2024 FieldReport Pro. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
