import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { BackButton } from "@/components/BackButton";
import { SettingsButton } from "@/components/SettingsButton";
import { GlassNavbar, NavbarLeft, NavbarCenter, NavbarRight, NavbarTitle } from "@/components/GlassNavbar";
import { ChevronDown, ChevronUp, Pencil, Printer, Download, FolderPlus, Plus, RefreshCw } from "lucide-react";
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
import { ReportTypeSelector, ReportType, AggregationSourceMode } from "@/components/ReportTypeSelector";

interface SummarySection {
  id: string;
  title: string;
  content?: string;
  isOpen: boolean;
}

interface SourceReport {
  id: string;
  project_name: string;
  created_at: string;
  job_description: string;
  report_type?: string;
}

const ReviewSummary = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const isSimpleMode = location.state?.simpleMode || false;
  const projectReportId = location.state?.reportId || null;
  const initialSummary = location.state?.summary || "";
  const capturedImages = location.state?.images || [];
  const [showProjectSelector, setShowProjectSelector] = useState(false);
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  
  // Report type state - Simple Mode defaults to field_report
  const [reportType, setReportType] = useState<ReportType>(isSimpleMode ? 'field_report' : 'daily');
  const [aggregationSourceMode, setAggregationSourceMode] = useState<AggregationSourceMode>('auto');
  const [availableSourceReports, setAvailableSourceReports] = useState<SourceReport[]>([]);
  const [selectedSourceReportIds, setSelectedSourceReportIds] = useState<string[]>([]);
  const [isLoadingSourceReports, setIsLoadingSourceReports] = useState(false);
  const [summaryText, setSummaryText] = useState(initialSummary);
  const [isRegenerating, setIsRegenerating] = useState(false);
  
  // Parse the AI-generated summary into sections
  const parseSummary = (text: string) => {
    const sections: SummarySection[] = [];
    
    // Extract SUMMARY section
    const summaryMatch = text.match(/SUMMARY:\s*([\s\S]*?)(?=KEY POINTS:|ACTION ITEMS:|$)/i);
    if (summaryMatch) {
      sections.push({
        id: "summary",
        title: t('reviewSummary.summary'),
        content: summaryMatch[1].trim(),
        isOpen: true
      });
    }
    
    // Extract KEY POINTS section
    const keyPointsMatch = text.match(/KEY POINTS:\s*([\s\S]*?)(?=ACTION ITEMS:|$)/i);
    if (keyPointsMatch) {
      sections.push({
        id: "keypoints",
        title: t('reviewSummary.keyPoints'),
        content: keyPointsMatch[1].trim(),
        isOpen: true
      });
    }
    
    // Extract ACTION ITEMS section
    const actionItemsMatch = text.match(/ACTION ITEMS:\s*([\s\S]*?)$/i);
    if (actionItemsMatch) {
      sections.push({
        id: "actions",
        title: t('reviewSummary.actionItems'),
        content: actionItemsMatch[1].trim(),
        isOpen: true
      });
    }
    
    return sections.length > 0 ? sections : [{
      id: "general",
      title: t('reviewSummary.reportSummary'),
      content: text,
      isOpen: true
    }];
  };

  const [sections, setSections] = useState<SummarySection[]>(() => parseSummary(summaryText));
  const [isSaving, setIsSaving] = useState(false);

  // Fetch source reports when weekly or monthly mode is selected
  useEffect(() => {
    if (reportType === 'weekly' || reportType === 'monthly') {
      fetchSourceReports();
    }
  }, [reportType]);

  // Auto-select source reports when auto mode is selected
  useEffect(() => {
    if (aggregationSourceMode === 'auto' && availableSourceReports.length > 0) {
      setSelectedSourceReportIds(availableSourceReports.map(r => r.id));
    } else if (aggregationSourceMode === 'fresh') {
      setSelectedSourceReportIds([]);
    }
  }, [aggregationSourceMode, availableSourceReports]);

  const fetchSourceReports = async () => {
    setIsLoadingSourceReports(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Determine date range and report type based on current selection
      let startDate: Date;
      let sourceReportType: string;
      
      if (reportType === 'monthly') {
        // Get weekly reports from the current month
        startDate = new Date();
        startDate.setDate(1); // First day of month
        startDate.setHours(0, 0, 0, 0);
        sourceReportType = 'weekly';
      } else {
        // Get daily reports from the current week (for weekly reports)
        startDate = new Date();
        startDate.setDate(startDate.getDate() - startDate.getDay());
        startDate.setHours(0, 0, 0, 0);
        sourceReportType = 'daily';
      }

      const { data, error } = await supabase
        .from('reports')
        .select('id, project_name, created_at, job_description, report_type')
        .eq('user_id', user.id)
        .eq('report_type', sourceReportType)
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: false });

      if (!error && data) {
        setAvailableSourceReports(data);
        if (aggregationSourceMode === 'auto') {
          setSelectedSourceReportIds(data.map(r => r.id));
        }
      }
    } catch (error) {
      console.error('Error fetching source reports:', error);
    } finally {
      setIsLoadingSourceReports(false);
    }
  };

  const toggleSection = (id: string) => {
    setSections((prev) =>
      prev.map((section) =>
        section.id === id ? { ...section, isOpen: !section.isOpen } : section
      )
    );
  };

  const handleRegenerateSummary = async () => {
    setIsRegenerating(true);
    try {
      // Get included source reports content for weekly/monthly mode
      let includedSourceReports: string[] = [];
      if ((reportType === 'weekly' || reportType === 'monthly') && aggregationSourceMode !== 'fresh' && selectedSourceReportIds.length > 0) {
        includedSourceReports = availableSourceReports
          .filter(r => selectedSourceReportIds.includes(r.id))
          .map(r => r.job_description);
      }

      // Get image data URLs for the AI
      const imageDataUrls = capturedImages.map((img: any) => img.url);

      const { data, error } = await supabase.functions.invoke('generate-report-summary', {
        body: {
          description: initialSummary,
          imageDataUrls,
          reportType,
          includedSourceReports: includedSourceReports.length > 0 ? includedSourceReports : undefined
        }
      });

      if (error) throw error;

      if (data?.summary) {
        setSummaryText(data.summary);
        setSections(parseSummary(data.summary));
        toast.success(t('reviewSummary.regenerated', 'Report regenerated!'));
      }
    } catch (error) {
      console.error('Error regenerating summary:', error);
      toast.error(t('reviewSummary.regenerateFailed', 'Failed to regenerate report'));
    } finally {
      setIsRegenerating(false);
    }
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
      toast.info(t('reviewSummary.alreadyLinked'));
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
        toast.error(t('reviewSummary.mustBeLoggedIn'));
        return;
      }

      let currentReportId = targetReportId;

      // If no project selected (standalone), create a new report
      if (!currentReportId) {
        const reportData = {
          user_id: user.id,
          project_name: t('reviewSummary.simpleModeReport'),
          customer_name: t('reviewSummary.standaloneReport'),
          job_number: `SM-${Date.now()}`,
          job_description: summaryText,
          report_type: reportType
        };

        const { data: report, error: reportError } = await supabase
          .from('reports')
          .insert(reportData)
          .select()
          .single();

        if (reportError) {
          console.error("Error saving report:", reportError);
          toast.error(t('reviewSummary.saveFailed'));
          return;
        }

        currentReportId = report.id;
      } else {
        // Update existing project report with summary and report type
        const { error: updateError } = await supabase
          .from('reports')
          .update({ job_description: summaryText, report_type: reportType })
          .eq('id', currentReportId);

        if (updateError) {
          console.error("Error updating report:", updateError);
          toast.error(t('reviewSummary.failedToUpdate'));
          return;
        }
      }

      // Upload captured images to storage and save to media table
      if (capturedImages.length > 0) {
        for (const image of capturedImages) {
          try {
            let storagePath = '';
            
            // If we have base64 data, convert to blob and upload
            if (image.base64 && image.base64.startsWith('data:')) {
              // Convert base64 to blob
              const response = await fetch(image.base64);
              const blob = await response.blob();
              
              const fileExt = image.base64.includes('image/png') ? 'png' : 'jpg';
              const fileName = `${user.id}/${currentReportId}/${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
              
              const { data: uploadData, error: uploadError } = await supabase.storage
                .from('media')
                .upload(fileName, blob, {
                  contentType: blob.type || 'image/jpeg',
                  upsert: false
                });
              
              if (uploadError) {
                console.error("Error uploading image:", uploadError);
                continue;
              }
              
              storagePath = uploadData.path;
            } else if (image.url && !image.url.startsWith('blob:')) {
              // If it's already a valid URL (not blob), use it
              storagePath = image.url;
            } else {
              console.warn("Skipping image without valid data:", image.id);
              continue;
            }
            
            // Save to media table
            const { error: mediaError } = await supabase
              .from('media')
              .insert({
                user_id: user.id,
                report_id: currentReportId,
                file_path: storagePath,
                file_type: 'image',
                mime_type: 'image/jpeg'
              });
            
            if (mediaError) {
              console.error("Error saving media record:", mediaError);
            }
          } catch (err) {
            console.error("Error processing image:", err);
          }
        }
      }

      toast.success(t('reviewSummary.reportSaved'));
      navigate("/confirmation", { state: { reportId: currentReportId } });
    } catch (error) {
      console.error("Error:", error);
      toast.error(t('reviewSummary.errorOccurred'));
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
    toast.success(t('reviewSummary.preparingToPrint'));
  };

  const handleSaveAsPDF = () => {
    toast.success(t('reviewSummary.savingAsPDF'));
  };

  return (
    <div className="dark min-h-screen bg-background">
      {/* Glass Navbar */}
      <GlassNavbar fixed={false}>
        <NavbarLeft>
          <BackButton />
        </NavbarLeft>
        <NavbarCenter>
          <NavbarTitle>{t('reviewSummary.title')}</NavbarTitle>
        </NavbarCenter>
        <NavbarRight>
          <SettingsButton />
        </NavbarRight>
      </GlassNavbar>

      <main className="flex flex-col pb-32 animate-fade-in">
        {/* Report Type Selector */}
        <div className="p-4">
          <ReportTypeSelector
            selectedType={reportType}
            onTypeChange={setReportType}
            aggregationSourceMode={aggregationSourceMode}
            onAggregationSourceModeChange={setAggregationSourceMode}
            availableSourceReports={availableSourceReports}
            selectedSourceReportIds={selectedSourceReportIds}
            onSourceReportSelectionChange={setSelectedSourceReportIds}
            isLoadingSourceReports={isLoadingSourceReports}
            isSimpleMode={isSimpleMode}
          />
        </div>

        {/* Accordions for Project Phases */}
        <div className="flex flex-col gap-3 p-4 pt-0">
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
                      onClick={() => toast.success(t('reviewSummary.editModeActivated'))}
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
              {t('reviewSummary.includedMedia')} ({capturedImages.length} {capturedImages.length === 1 ? t('reviewSummary.photo') : t('reviewSummary.photos')})
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
                      alt={image.caption || `Captured photo ${index + 1}`}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">
                      {image.caption || `${t('reviewSummary.photo')} ${index + 1}`}
                    </h3>
                    {!image.caption && (
                      <p className="text-xs text-muted-foreground">
                        {t('reviewSummary.fieldPhoto')}
                      </p>
                    )}
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
          disabled={isRegenerating}
          className="w-full py-6 text-base font-semibold"
        >
          {isRegenerating ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              {t('reviewSummary.regenerating', 'Regenerating...')}
            </>
          ) : (
            t('reviewSummary.regenerate')
          )}
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
                <span className="text-xs">{t('reviewSummary.print')}</span>
              </Button>
              <Button
                onClick={handleSaveAsPDF}
                variant="outline"
                className="flex flex-col gap-2 py-6"
              >
                <Download className="h-5 w-5" />
                <span className="text-xs">{t('reviewSummary.savePDF')}</span>
              </Button>
              <Button
                onClick={handleLinkToProject}
                variant="outline"
                className="flex flex-col gap-2 py-6"
              >
                <FolderPlus className="h-5 w-5" />
                <span className="text-xs">{t('reviewSummary.link')}</span>
              </Button>
            </div>
            <Button
              onClick={handleContinueToReport}
              disabled={isSaving}
              className="w-full bg-primary py-6 text-base font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {isSaving ? t('reviewSummary.saving') : t('reviewSummary.finalize')}
            </Button>
          </>
        ) : (
          <Button
            onClick={handleContinueToReport}
            disabled={isSaving}
            className="w-full bg-primary py-6 text-base font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {isSaving ? t('reviewSummary.saving') : t('reviewSummary.continueToReport')}
          </Button>
        )}
      </div>

      {/* Project Selector Dialog for Simple Mode */}
      <Dialog open={showProjectSelector} onOpenChange={setShowProjectSelector}>
        <DialogContent className="max-w-md bg-background">
          <DialogHeader>
            <DialogTitle className="text-foreground">{t('reviewSummary.linkToProject')}</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {t('reviewSummary.chooseOrSave')}
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
                <div className="font-semibold">{t('reviewSummary.saveStandalone')}</div>
                <div className="text-xs text-muted-foreground">{t('reviewSummary.notLinked')}</div>
              </div>
            </Button>

            {/* Create New Project */}
            <Button
              onClick={handleCreateNewProject}
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="mr-2 h-4 w-4" />
              {t('reviewSummary.createNewProject')}
            </Button>

            {/* Existing Projects */}
            {projects.length > 0 && (
              <>
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-border" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">{t('reviewSummary.orSelectExisting')}</span>
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
