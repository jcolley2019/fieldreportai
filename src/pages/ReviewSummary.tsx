import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { BackButton } from "@/components/BackButton";
import { ChevronDown, ChevronUp, Pencil, Play, Printer, Download, FolderPlus, Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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
  const projectReportId = location.state?.reportId || null;
  const summaryText = location.state?.summary || "";
  const capturedImages = location.state?.images || [];
  const [showProjectSelector, setShowProjectSelector] = useState(false);
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  
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

  const fetchProjects = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('reports')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (!error && data) {
        setProjects(data);
      }
    } catch (error) {
      console.error('Error fetching projects:', error);
    }
  };

  const handleLinkToProject = async () => {
    if (isSimpleMode) {
      await fetchProjects();
      setShowProjectSelector(true);
    } else {
      toast.info("This report is already linked to a project");
    }
  };

  const handleCreateNewProject = () => {
    setShowProjectSelector(false);
    navigate("/new-project", { 
      state: { 
        returnTo: "/review-summary",
        summary: summaryText,
        images: capturedImages
      } 
    });
  };

  const saveReportToProject = async (targetReportId: string | null) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast.error("You must be logged in to save reports");
        return;
      }

      let currentReportId = targetReportId;

      // If no project selected (standalone), create a new report
      if (!currentReportId) {
        const reportData = {
          user_id: user.id,
          project_name: "Simple Mode Report",
          customer_name: "Standalone Report",
          job_number: `SM-${Date.now()}`,
          job_description: summaryText
        };

        const { data: report, error: reportError } = await supabase
          .from('reports')
          .insert(reportData)
          .select()
          .single();

        if (reportError) {
          console.error("Error saving report:", reportError);
          toast.error("Failed to save report");
          return;
        }

        currentReportId = report.id;
      } else {
        // Update existing project report with summary
        const { error: updateError } = await supabase
          .from('reports')
          .update({ job_description: summaryText })
          .eq('id', currentReportId);

        if (updateError) {
          console.error("Error updating report:", updateError);
          toast.error("Failed to update report");
          return;
        }
      }

      // Save captured images to media table
      if (capturedImages.length > 0) {
        const mediaEntries = capturedImages.map((image: any) => ({
          user_id: user.id,
          report_id: currentReportId,
          file_path: image.path || image.url,
          file_type: 'image',
          mime_type: 'image/jpeg'
        }));

        const { error: mediaError } = await supabase
          .from('media')
          .insert(mediaEntries);

        if (mediaError) {
          console.error("Error saving media:", mediaError);
        }
      }

      toast.success("Report saved successfully!");
      navigate("/confirmation", { state: { reportId: currentReportId } });
    } catch (error) {
      console.error("Error:", error);
      toast.error("An error occurred while saving");
    }
  };

  const handleContinueToReport = async () => {
    setIsSaving(true);
    
    // If in Simple Mode and no project selected, show selector
    if (isSimpleMode && !selectedProjectId && !projectReportId) {
      await fetchProjects();
      setShowProjectSelector(true);
      setIsSaving(false);
      return;
    }

    // Use selected project or existing project from state
    await saveReportToProject(selectedProjectId || projectReportId);
    setIsSaving(false);
  };

  const handlePrint = () => {
    toast.success("Preparing to print...");
  };

  const handleSaveAsPDF = () => {
    toast.success("Saving as PDF...");
  };

  return (
    <div className="dark min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 flex items-center bg-background/80 p-4 backdrop-blur-sm">
        <BackButton />
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

      {/* Project Selector Dialog for Simple Mode */}
      <Dialog open={showProjectSelector} onOpenChange={setShowProjectSelector}>
        <DialogContent className="max-w-md bg-background">
          <DialogHeader>
            <DialogTitle className="text-foreground">Link to Project</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Choose an existing project or save as standalone
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {/* Save as Standalone Option */}
            <Button
              onClick={() => {
                setShowProjectSelector(false);
                saveReportToProject(null);
              }}
              variant="outline"
              className="w-full justify-start h-auto p-4"
            >
              <div className="text-left">
                <div className="font-semibold">Save as Standalone</div>
                <div className="text-xs text-muted-foreground">Not linked to any project</div>
              </div>
            </Button>

            {/* Create New Project */}
            <Button
              onClick={handleCreateNewProject}
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="mr-2 h-4 w-4" />
              Create New Project
            </Button>

            {/* Existing Projects */}
            {projects.length > 0 && (
              <>
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-border" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">Or select existing</span>
                  </div>
                </div>
                
                {projects.map((project) => (
                  <Button
                    key={project.id}
                    onClick={() => {
                      setSelectedProjectId(project.id);
                      setShowProjectSelector(false);
                      saveReportToProject(project.id);
                    }}
                    variant="outline"
                    className="w-full justify-start h-auto p-4"
                  >
                    <div className="text-left">
                      <div className="font-semibold">{project.project_name}</div>
                      <div className="text-xs text-muted-foreground">
                        {project.customer_name} • {project.job_number}
                      </div>
                    </div>
                  </Button>
                ))}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ReviewSummary;
