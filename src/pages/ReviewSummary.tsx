import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ChevronDown, ChevronUp, Pencil, Play } from "lucide-react";
import { toast } from "sonner";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface SummarySection {
  id: string;
  title: string;
  content?: string;
  isOpen: boolean;
}

const ReviewSummary = () => {
  const navigate = useNavigate();
  const [sections, setSections] = useState<SummarySection[]>([
    { id: "1", title: "Site Prep", isOpen: false },
    {
      id: "2",
      title: "Foundation",
      content:
        "Forms for the foundation walls have been set. Pre-pour inspection scheduled for tomorrow morning. All materials are on-site and ready for the next phase.",
      isOpen: true,
    },
    { id: "3", title: "Framing", isOpen: false },
  ]);

  const mockMedia = [
    { id: "1", type: "photo", title: "Concrete Pour", url: "placeholder" },
    { id: "2", type: "video", title: "Plumbing", url: "placeholder" },
    { id: "3", type: "photo", title: "Rebar", url: "placeholder" },
  ];

  const toggleSection = (id: string) => {
    setSections((prev) =>
      prev.map((section) =>
        section.id === id ? { ...section, isOpen: !section.isOpen } : section
      )
    );
  };

  const handleRegenerateSummary = () => {
    toast.success("Regenerating summary...");
  };

  const handleContinueToReport = () => {
    toast.success("Report submitted successfully!");
    navigate("/final-report");
  };

  return (
    <div className="dark min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 flex items-center bg-background/80 p-4 backdrop-blur-sm">
        <button
          onClick={() => navigate(-1)}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full hover:bg-secondary"
        >
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
        <h1 className="flex-1 pr-10 text-center text-lg font-bold text-foreground">
          Review Summary
        </h1>
      </header>

      <main className="flex flex-col pb-32">
        {/* Accordions for Project Phases */}
        <div className="flex flex-col gap-3 p-4">
          {sections.map((section) => (
            <Collapsible
              key={section.id}
              open={section.isOpen}
              onOpenChange={() => toggleSection(section.id)}
              className="rounded-lg bg-card"
            >
              <CollapsibleTrigger className="flex w-full items-center justify-between px-4 py-4 text-left">
                <h3 className="text-lg font-semibold text-foreground">
                  {section.title}
                </h3>
                {section.isOpen ? (
                  <ChevronUp className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-muted-foreground" />
                )}
              </CollapsibleTrigger>
              {section.content && (
                <CollapsibleContent className="px-4 pb-4">
                  <div className="relative rounded-lg bg-secondary p-4">
                    <p className="pr-8 text-sm leading-relaxed text-muted-foreground">
                      {section.content}
                    </p>
                    <button
                      onClick={() => toast.success("Edit mode activated")}
                      className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                  </div>
                </CollapsibleContent>
              )}
            </Collapsible>
          ))}
        </div>

        {/* Included Media */}
        <div className="px-4 py-6">
          <h2 className="mb-4 text-xl font-bold text-foreground">
            Included Media
          </h2>
          <div className="grid grid-cols-2 gap-4">
            {mockMedia.map((media) => (
              <div
                key={media.id}
                className="flex flex-col gap-2 rounded-lg bg-card p-3"
              >
                <div className="relative aspect-square overflow-hidden rounded-lg bg-muted">
                  {media.type === "video" ? (
                    <div className="flex h-full items-center justify-center">
                      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/20">
                        <Play className="h-8 w-8 text-primary" fill="currentColor" />
                      </div>
                    </div>
                  ) : (
                    <div className="h-full w-full bg-gradient-to-br from-muted to-secondary" />
                  )}
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">
                    {media.title}
                  </h3>
                  <p className="text-xs text-muted-foreground capitalize">
                    {media.type}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Bottom Actions */}
      <div className="fixed bottom-0 left-0 right-0 flex flex-col gap-3 bg-background/80 p-4 backdrop-blur-sm">
        <Button
          onClick={handleRegenerateSummary}
          variant="secondary"
          className="w-full py-6 text-base font-semibold"
        >
          Regenerate Summary
        </Button>
        <Button
          onClick={handleContinueToReport}
          className="w-full bg-primary py-6 text-base font-semibold text-primary-foreground hover:bg-primary/90"
        >
          Continue to Report
        </Button>
      </div>
    </div>
  );
};

export default ReviewSummary;
