import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ChevronDown, ChevronUp, Pencil, Play, Printer, Download, FolderPlus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
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
  const location = useLocation();
  const isSimpleMode = location.state?.simpleMode || false;
  const summaryText = location.state?.summary || "";
  const capturedImages = location.state?.images || [];
  
  // Parse the AI-generated summary into sections
  const parseSummary = (text: string) => {
    const sections: SummarySection[] = [];
    
    // Extract SUMMARY section
    const summaryMatch = text.match(/SUMMARY:\s*([\s\S]*?)(?=KEY POINTS:|ACTION ITEMS:|$)/i);
    if (summaryMatch) {
      sections.push({
        id: "summary",
        title: "Summary",
        content: summaryMatch[1].trim(),
        isOpen: true
      });
    }
    
    // Extract KEY POINTS section
    const keyPointsMatch = text.match(/KEY POINTS:\s*([\s\S]*?)(?=ACTION ITEMS:|$)/i);
    if (keyPointsMatch) {
      sections.push({
        id: "keypoints",
        title: "Key Points",
        content: keyPointsMatch[1].trim(),
        isOpen: true
      });
    }
    
    // Extract ACTION ITEMS section
    const actionItemsMatch = text.match(/ACTION ITEMS:\s*([\s\S]*?)$/i);
    if (actionItemsMatch) {
      sections.push({
        id: "actions",
        title: "Action Items",
        content: actionItemsMatch[1].trim(),
        isOpen: true
      });
    }
    
    return sections.length > 0 ? sections : [{
      id: "general",
      title: "Report Summary",
      content: text,
      isOpen: true
    }];
  };

  const [sections, setSections] = useState<SummarySection[]>(() => parseSummary(summaryText));
  const [isSaving, setIsSaving] = useState(false);

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

  const handleContinueToReport = async () => {
    setIsSaving(true);
    
    try {
      // Get the current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        toast.error("You must be logged in to save reports");
        setIsSaving(false);
        return;
      }

      // For Simple Mode, we'll create a temporary report entry
      // In Project Mode, this would be linked to an actual project
      const reportData = {
        user_id: user.id,
        project_name: "Simple Mode Report",
        customer_name: "N/A",
        job_number: `SM-${Date.now()}`,
        job_description: summaryText.substring(0, 500) // Store a portion of the summary
      };

      const { data: report, error: reportError } = await supabase
        .from('reports')
        .insert(reportData)
        .select()
        .single();

      if (reportError) {
        console.error("Error saving report:", reportError);
        toast.error("Failed to save report");
        setIsSaving(false);
        return;
      }

      toast.success("Report saved successfully!");
      navigate("/confirmation", { state: { reportId: report.id, reportData: report } });
    } catch (error) {
      console.error("Error:", error);
      toast.error("An error occurred while saving");
    } finally {
      setIsSaving(false);
    }
  };

  const handlePrint = () => {
    toast.success("Preparing to print...");
  };

  const handleSaveAsPDF = () => {
    toast.success("Saving as PDF...");
  };

  const handleLinkToProject = () => {
    toast.success("Link to project/customer");
    // Navigate to project selection or creation
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
        {capturedImages.length > 0 && (
          <div className="px-4 py-6">
            <h2 className="mb-4 text-xl font-bold text-foreground">
              Included Media ({capturedImages.length} {capturedImages.length === 1 ? 'photo' : 'photos'})
            </h2>
            <div className="grid grid-cols-2 gap-4">
              {capturedImages.map((image: any, index: number) => (
                <div
                  key={image.id || index}
                  className="flex flex-col gap-2 rounded-lg bg-card p-3"
                >
                  <div className="relative aspect-square overflow-hidden rounded-lg bg-muted">
                    <img 
                      src={image.url} 
                      alt={`Captured photo ${index + 1}`}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">
                      Photo {index + 1}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Field photo
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
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
        
        {isSimpleMode ? (
          <>
            <div className="grid grid-cols-3 gap-3">
              <Button
                onClick={handlePrint}
                variant="outline"
                className="flex flex-col gap-2 py-6"
              >
                <Printer className="h-5 w-5" />
                <span className="text-xs">Print</span>
              </Button>
              <Button
                onClick={handleSaveAsPDF}
                variant="outline"
                className="flex flex-col gap-2 py-6"
              >
                <Download className="h-5 w-5" />
                <span className="text-xs">Save PDF</span>
              </Button>
              <Button
                onClick={handleLinkToProject}
                variant="outline"
                className="flex flex-col gap-2 py-6"
              >
                <FolderPlus className="h-5 w-5" />
                <span className="text-xs">Link</span>
              </Button>
            </div>
            <Button
              onClick={handleContinueToReport}
              disabled={isSaving}
              className="w-full bg-primary py-6 text-base font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {isSaving ? "Saving..." : "Finalize Report"}
            </Button>
          </>
        ) : (
          <Button
            onClick={handleContinueToReport}
            disabled={isSaving}
            className="w-full bg-primary py-6 text-base font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {isSaving ? "Saving..." : "Continue to Report"}
          </Button>
        )}
      </div>
    </div>
  );
};

export default ReviewSummary;
