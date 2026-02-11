import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Camera, FileText, Clock, Users, Shield, Zap, ArrowRight, Star, Play, ListTodo, Linkedin, Instagram, Facebook, Youtube, AlertTriangle, FolderOpen, FileX, Timer, ArrowDown, ChevronDown, ArrowUp, Menu, X } from "lucide-react";
import { Link } from "react-router-dom";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import logo from "@/assets/field-report-ai-logo.png";
import { PricingSection } from "@/components/PricingSection";
import LandingChatBot from "@/components/LandingChatBot";
import { ScrollAnimation } from "@/hooks/useScrollAnimation";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetClose,
} from "@/components/ui/sheet";
import StepPreviewDialog from "@/components/StepPreviewDialog";

const Landing = () => {
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [previewStep, setPreviewStep] = useState<'capture' | 'generate' | 'share' | null>(null);

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 400);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

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
    {
      icon: <ListTodo className="h-8 w-8" />,
      title: "Smart Task Management",
      description: "AI analyzes your reports and automatically suggests follow-up tasks, deadlines, and priorities.",
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
            <img src={logo} alt="Field Report AI" className="h-12 md:h-16 w-auto" />
            <span className="font-bold text-lg md:text-xl text-white">Field Report AI</span>
          </div>
          
          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-6">
            <a href="#features" className="text-sm text-foreground/80 hover:text-foreground transition-colors">Features</a>
            <a href="#pricing" className="text-sm text-foreground/80 hover:text-foreground transition-colors">Pricing</a>
            <a href="#faq" className="text-sm text-foreground/80 hover:text-foreground transition-colors">FAQ</a>
            <Link to="/auth">
              <Button variant="secondary" size="sm" className="border-2 border-primary font-bold">Sign In</Button>
            </Link>
            <Link to="/auth?startTrial=true">
              <Button size="sm">Get Started Free</Button>
            </Link>
          </nav>

          {/* Mobile Navigation */}
          <Sheet>
            <SheetTrigger asChild className="md:hidden">
              <Button variant="ghost" size="icon" className="text-foreground">
                <Menu className="h-6 w-6" />
                <span className="sr-only">Open menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[280px] bg-background border-border">
              <div className="flex flex-col gap-6 mt-8">
                <div className="flex items-center gap-3 mb-4">
                  <img src={logo} alt="Field Report AI" className="h-10 w-auto" />
                  <span className="font-bold text-lg text-white">Field Report AI</span>
                </div>
                
                <nav className="flex flex-col gap-4">
                  <SheetClose asChild>
                    <a href="#features" className="text-lg text-foreground/80 hover:text-foreground transition-colors py-2 border-b border-border/50">
                      Features
                    </a>
                  </SheetClose>
                  <SheetClose asChild>
                    <a href="#pricing" className="text-lg text-foreground/80 hover:text-foreground transition-colors py-2 border-b border-border/50">
                      Pricing
                    </a>
                  </SheetClose>
                  <SheetClose asChild>
                    <a href="#faq" className="text-lg text-foreground/80 hover:text-foreground transition-colors py-2 border-b border-border/50">
                      FAQ
                    </a>
                  </SheetClose>
                </nav>

                <div className="flex flex-col gap-3 mt-4">
                  <SheetClose asChild>
                    <Link to="/auth">
                      <Button variant="secondary" className="w-full border-2 border-primary font-bold">Sign In</Button>
                    </Link>
                  </SheetClose>
                  <SheetClose asChild>
                    <Link to="/auth?startTrial=true">
                      <Button className="w-full">Get Started Free</Button>
                    </Link>
                  </SheetClose>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 md:py-32 bg-gradient-to-b from-background via-background to-primary/5 relative overflow-hidden animate-fade-in">
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
              <Link to="/auth?startTrial=true">
                <Button size="lg" className="gap-2 shadow-lg shadow-primary/20">
                  Get Started Free <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
            
            <div className="grid grid-cols-3 gap-3 md:gap-8 max-w-2xl mx-auto px-2 md:px-0">
              {stats.map((stat, index) => (
                <div key={index} className="flex flex-col items-center justify-center text-center p-3 md:p-4 rounded-lg bg-primary/5 border border-primary/10">
                  <div className="text-2xl md:text-3xl font-bold text-primary mb-1">{stat.value}</div>
                  <div className="text-xs md:text-sm text-muted-foreground text-center leading-tight">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Pain Points */}
      <section className="py-20 bg-gradient-to-b from-muted/20 to-primary/5 relative overflow-hidden">
        {/* Subtle background pattern */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute top-10 left-1/4 w-48 h-48 bg-primary rounded-full blur-3xl"></div>
          <div className="absolute bottom-10 right-1/4 w-64 h-64 bg-primary rounded-full blur-3xl"></div>
        </div>
        
        <div className="container mx-auto px-4 relative z-10">
          <ScrollAnimation className="max-w-4xl mx-auto text-center mb-16">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 border-2 border-primary/30 mb-6">
              <AlertTriangle className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-3xl md:text-5xl font-bold mb-4 text-white">
              Still Doing Reports <span className="text-primary">The Old Way?</span>
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Your competitors are already saving hours every day. Here's what's holding you back:
            </p>
          </ScrollAnimation>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
            {[
              {
                icon: <Timer className="h-8 w-8" />,
                title: "2+ Hours Wasted Daily",
                description: "Writing reports after a 10-hour shift? That's unpaid overtime eating into your life.",
                stat: "2+ hrs/day",
              },
              {
                icon: <FolderOpen className="h-8 w-8" />,
                title: "Photo Chaos",
                description: "Hundreds of photos across phones, emails, and folders. Good luck finding the right one.",
                stat: "500+ photos/week",
              },
              {
                icon: <FileX className="h-8 w-8" />,
                title: "Inconsistent Reports",
                description: "Every team member formats differently. Clients notice. Your credibility takes a hit.",
                stat: "Zero standards",
              },
              {
                icon: <Clock className="h-8 w-8" />,
                title: "Critical Details Missed",
                description: "By the time you write the report, you've forgotten half of what you saw. Errors happen.",
                stat: "35% error rate",
              },
            ].map((pain, index) => (
              <ScrollAnimation key={index} delay={index * 100} animation="fade-up">
                <Card 
                  className="group relative bg-card/50 backdrop-blur border-primary/30 hover:border-primary/60 transition-all duration-300 hover:shadow-lg hover:shadow-primary/10 hover:-translate-y-1 h-full"
                >
                  <CardContent className="pt-8 pb-6 text-center">
                    <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary/10 text-primary mb-4 group-hover:bg-primary group-hover:text-primary-foreground transition-colors duration-300">
                      {pain.icon}
                    </div>
                    <div className="text-xs font-bold text-primary/80 mb-2 tracking-wider uppercase">
                      {pain.stat}
                    </div>
                    <h3 className="text-lg font-bold text-white mb-2">{pain.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{pain.description}</p>
                  </CardContent>
                </Card>
              </ScrollAnimation>
            ))}
          </div>
          
          {/* Subtle scroll transition */}
          <div className="flex flex-col items-center mt-16 mb-8">
            <p className="text-muted-foreground mb-6 text-sm tracking-wide">There's a better way</p>
            <div className="flex flex-col items-center opacity-60 hover:opacity-100 transition-opacity duration-300">
              <div className="w-px h-8 bg-gradient-to-b from-primary/60 to-primary/20"></div>
              <ChevronDown className="h-5 w-5 text-primary animate-pulse-slow mt-1" />
            </div>
          </div>
        </div>
      </section>
      
      {/* Subtle visual connector */}
      <div className="h-4 bg-gradient-to-b from-transparent via-primary/5 to-transparent"></div>

      {/* How It Works */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <ScrollAnimation className="max-w-4xl mx-auto text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-white">Field Reporting Made Simple</h2>
            <p className="text-muted-foreground">Three steps to professional documentation — click to learn more</p>
          </ScrollAnimation>
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {steps.map((step, index) => {
              const stepKey = step.title.toLowerCase() as 'capture' | 'generate' | 'share';
              return (
                <ScrollAnimation key={index} delay={index * 150} animation="fade-up">
                  <button 
                    onClick={() => setPreviewStep(stepKey)}
                    className="text-center group w-full cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background rounded-2xl p-6 bg-card/50 border border-border/50 hover:bg-primary/10 hover:border-primary/30 transition-all duration-300 flex flex-col items-center min-h-[280px] shadow-lg shadow-black/5"
                  >
                    <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/10 border-2 border-primary/20 text-primary mb-4 group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-300 group-hover:scale-110 flex-shrink-0">
                      {step.icon}
                    </div>
                    <h3 className="text-xl font-semibold mb-2 text-white group-hover:text-primary transition-colors">{step.title}</h3>
                    <p className="text-muted-foreground min-h-[48px]">{step.description}</p>
                    <span className="inline-block mt-auto pt-3 text-xs text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                      Click to preview →
                    </span>
                  </button>
                </ScrollAnimation>
              );
            })}
          </div>
          {/* Arrows between cards - shown separately below on desktop */}
          <div className="hidden md:flex justify-center gap-8 max-w-5xl mx-auto mt-4">
            <div className="flex-1 flex justify-center">
              <ArrowRight className="h-6 w-6 text-primary/40" />
            </div>
            <div className="flex-1 flex justify-center">
              <ArrowRight className="h-6 w-6 text-primary/40" />
            </div>
            <div className="flex-1"></div>
          </div>
        </div>
      </section>

      {/* Step Preview Dialog */}
      <StepPreviewDialog 
        open={previewStep !== null} 
        onOpenChange={(open) => !open && setPreviewStep(null)} 
        step={previewStep} 
      />

      {/* Features */}
      <section id="features" className="py-20 bg-muted/30 scroll-mt-24">
        <div className="container mx-auto px-4">
          <ScrollAnimation className="max-w-4xl mx-auto text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-white">Everything You Need to Document Your Job Site</h2>
            <p className="text-muted-foreground">Powerful features designed for field professionals</p>
          </ScrollAnimation>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {features.map((feature, index) => (
              <ScrollAnimation key={index} delay={index * 100} animation="fade-up">
                <Card className="hover:shadow-lg transition-shadow h-full">
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
              </ScrollAnimation>
            ))}
          </div>
        </div>
      </section>

      {/* Social Proof */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <ScrollAnimation className="max-w-4xl mx-auto text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-white">Trusted by Construction Teams</h2>
            <p className="text-muted-foreground">See what professionals are saying</p>
          </ScrollAnimation>
          <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {testimonials.map((testimonial, index) => (
              <ScrollAnimation key={index} delay={index * 150} animation="scale-in">
                <Card className="h-full">
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
              </ScrollAnimation>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <PricingSection />

      {/* FAQ */}
      <section id="faq" className="py-20 bg-muted/30 scroll-mt-24">
        <div className="container mx-auto px-4">
          <ScrollAnimation className="max-w-4xl mx-auto text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-white">Frequently Asked Questions</h2>
          </ScrollAnimation>
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
              <Link to="/auth?startTrial=true">
                <Button size="lg" className="gap-2">
                  Get Started Free <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
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
              <p className="text-sm text-muted-foreground mb-4">
                Professional field reporting powered by AI
              </p>
              <div className="flex items-center gap-3">
                <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors">
                  <Linkedin className="h-5 w-5" />
                </a>
                <a href="https://tiktok.com" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors">
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
                  </svg>
                </a>
                <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors">
                  <Instagram className="h-5 w-5" />
                </a>
                <a href="https://facebook.com" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors">
                  <Facebook className="h-5 w-5" />
                </a>
                <a href="https://youtube.com" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors">
                  <Youtube className="h-5 w-5" />
                </a>
              </div>
            </div>
            <div>
              <h3 className="font-semibold mb-4 text-white">Product</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#features" className="hover:text-foreground">Features</a></li>
                <li><a href="#pricing" className="hover:text-foreground">Pricing</a></li>
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
            <p>© 2026 Field Report AI. All rights reserved.</p>
          </div>
        </div>
      </footer>

      {/* AI Chatbot */}
      <LandingChatBot />

      {/* Scroll to Top Button */}
      <button
        onClick={scrollToTop}
        className={`fixed bottom-36 right-6 z-50 p-3 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 transition-all duration-300 hover:scale-110 hover:shadow-xl hover:shadow-primary/40 ${
          showScrollTop ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
        }`}
        aria-label="Scroll to top"
      >
        <ArrowUp className="h-5 w-5" />
      </button>
    </div>
  );
};

export default Landing;
