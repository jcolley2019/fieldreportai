import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Building2, Download, Share2, ChevronRight } from "lucide-react";
import { toast } from "sonner";

const FinalReport = () => {
  const navigate = useNavigate();

  const handleDownloadPDF = () => {
    toast.success("Downloading PDF...");
  };

  const handleShare = () => {
    toast.success("Opening share options...");
  };

  const handleForward = () => {
    toast.success("Forwarding report...");
  };

  return (
    <div className="dark min-h-screen bg-background">
      {/* Sticky Header */}
      <header className="sticky top-0 z-10 w-full border-b border-border bg-background/80 backdrop-blur-sm">
        <div className="flex flex-col gap-2 p-4 pb-3">
          <div className="flex h-12 items-center justify-between">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center text-primary">
              <Building2 className="h-8 w-8" />
            </div>
            <div className="flex w-auto items-center justify-end">
              <p className="shrink-0 text-sm font-medium text-muted-foreground">
                Oct 21-27, 2023
              </p>
            </div>
          </div>
          <p className="text-2xl font-bold leading-tight tracking-tight text-foreground">
            Project Alpha - Site Inspection
          </p>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow pb-40">
        <div className="pt-6">
          <h1 className="px-4 pb-3 text-left text-[32px] font-bold leading-tight tracking-tight text-foreground">
            AI-Generated Weekly Summary
          </h1>
          <p className="px-4 pb-3 pt-1 text-base font-normal leading-relaxed text-muted-foreground">
            AI-generated text describing key findings, progress, and issues
            identified during the week's site inspection. This summary highlights
            critical updates and provides a concise overview for project
            stakeholders.
          </p>

          {/* Photo Grid */}
          <div className="grid grid-cols-2 gap-3 px-4 pb-8">
            <div className="aspect-square overflow-hidden rounded-xl bg-muted">
              <div className="h-full w-full bg-gradient-to-br from-primary/20 to-primary/5" />
            </div>
            <div className="aspect-square overflow-hidden rounded-xl bg-muted">
              <div className="h-full w-full bg-gradient-to-br from-accent/20 to-accent/5" />
            </div>
          </div>

          {/* Safety Observations Section */}
          <div className="px-4 pb-8">
            <h2 className="pb-2 text-2xl font-bold text-foreground">
              Safety Observations
            </h2>
            <p className="text-base leading-relaxed text-muted-foreground">
              Minor safety infractions were noted, including improper use of
              personal protective equipment (PPE) in Zone B. All issues were
              addressed immediately with the site supervisor and corrective actions
              have been implemented.
            </p>
          </div>

          {/* Material Deliveries Section */}
          <div className="px-4 pb-8">
            <h2 className="pb-2 text-2xl font-bold text-foreground">
              Material Deliveries
            </h2>
            <p className="pb-4 text-base leading-relaxed text-muted-foreground">
              Scheduled delivery of steel beams was completed on Monday. Concrete
              delivery is on track for next Wednesday. No material shortages are
              currently reported.
            </p>

            {/* Photo Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="aspect-square overflow-hidden rounded-xl bg-muted">
                <div className="h-full w-full bg-gradient-to-br from-secondary/30 to-secondary/10" />
              </div>
              <div className="aspect-square overflow-hidden rounded-xl bg-muted">
                <div className="h-full w-full bg-gradient-to-br from-muted to-secondary/20" />
              </div>
            </div>
          </div>

          {/* Next Steps Section */}
          <div className="px-4 pb-8">
            <h2 className="pb-2 text-2xl font-bold text-foreground">
              Next Steps
            </h2>
            <p className="text-base leading-relaxed text-muted-foreground">
              Focus for the upcoming week will be on completing the foundation pour
              in Zone C and beginning the structural steel assembly. A pre-pour
              inspection is scheduled for Tuesday morning.
            </p>
          </div>
        </div>
      </main>

      {/* Bottom Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-border bg-background/80 p-4 backdrop-blur-sm">
        <div className="mb-3 flex gap-3">
          <Button
            onClick={handleDownloadPDF}
            className="flex-1 bg-primary py-6 text-base font-semibold text-primary-foreground hover:bg-primary/90"
          >
            <Download className="mr-2 h-5 w-5" />
            PDF
          </Button>
          <Button
            onClick={handleShare}
            variant="secondary"
            className="flex h-auto w-14 items-center justify-center py-6"
          >
            <Share2 className="h-5 w-5" />
          </Button>
          <Button
            onClick={handleForward}
            variant="secondary"
            className="flex h-auto w-14 items-center justify-center py-6"
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
        <p className="text-center text-xs text-muted-foreground">
          Report generated on Oct 27, 2023 at 4:15 PM
        </p>
      </div>
    </div>
  );
};

export default FinalReport;
