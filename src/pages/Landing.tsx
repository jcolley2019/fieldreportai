import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { FileText, Camera, ListChecks, Mic, Zap, Shield, Cloud } from "lucide-react";

const Landing = () => {
  const navigate = useNavigate();

  const features = [
    {
      icon: Camera,
      title: "Photo Capture",
      description: "Capture and annotate site photos instantly with your mobile device"
    },
    {
      icon: Mic,
      title: "Voice Input",
      description: "Dictate notes and reports hands-free while on site"
    },
    {
      icon: ListChecks,
      title: "Smart Checklists",
      description: "Create and manage custom checklists for any inspection"
    },
    {
      icon: FileText,
      title: "Instant Reports",
      description: "Generate professional reports in seconds, not hours"
    },
    {
      icon: Zap,
      title: "Lightning Fast",
      description: "Work offline and sync when you're back online"
    },
    {
      icon: Shield,
      title: "Secure & Reliable",
      description: "Your data is encrypted and backed up automatically"
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="border-b border-border bg-background/80 backdrop-blur-sm">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2">
            <Cloud className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-bold text-foreground">FieldReport Pro</h1>
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
            >
              Get Started
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20 text-center">
        <div className="mx-auto max-w-3xl">
          <h2 className="mb-6 text-5xl font-bold text-foreground md:text-6xl">
            Field Reporting,
            <span className="text-primary"> Simplified</span>
          </h2>
          <p className="mb-8 text-lg text-muted-foreground md:text-xl">
            Create professional site inspection reports in minutes with voice input, 
            photo capture, and smart checklists. Built for teams who need to move fast.
          </p>
          <div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
            <Button
              size="lg"
              className="text-lg"
              onClick={() => navigate("/auth")}
            >
              Start Free Trial
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="text-lg"
              onClick={() => {
                document.getElementById("features")?.scrollIntoView({ behavior: "smooth" });
              }}
            >
              Learn More
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="bg-muted/30 py-20">
        <div className="container mx-auto px-4">
          <div className="mb-12 text-center">
            <h3 className="mb-4 text-3xl font-bold text-foreground md:text-4xl">
              Everything You Need
            </h3>
            <p className="text-lg text-muted-foreground">
              Powerful features designed for field professionals
            </p>
          </div>
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {features.map((feature, index) => (
              <div
                key={index}
                className="rounded-lg bg-card p-6 transition-all hover:shadow-lg"
              >
                <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                  <feature.icon className="h-6 w-6 text-primary" />
                </div>
                <h4 className="mb-2 text-xl font-semibold text-foreground">
                  {feature.title}
                </h4>
                <p className="text-muted-foreground">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-20 text-center">
        <div className="mx-auto max-w-2xl">
          <h3 className="mb-6 text-3xl font-bold text-foreground md:text-4xl">
            Ready to Transform Your Workflow?
          </h3>
          <p className="mb-8 text-lg text-muted-foreground">
            Join thousands of field professionals who trust FieldReport Pro
          </p>
          <Button
            size="lg"
            className="text-lg"
            onClick={() => navigate("/auth")}
          >
            Get Started Free
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-muted/30 py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>&copy; 2024 FieldReport Pro. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
