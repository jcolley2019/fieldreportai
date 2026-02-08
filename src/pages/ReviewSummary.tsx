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
import { ReportTypeSelector, ReportType, WeeklySourceMode } from "@/components/ReportTypeSelector";

interface SummarySection {
  id: string;
  title: string;
  content?: string;
  isOpen: boolean;
}

interface DailyReport {
  id: string;
  project_name: string;
  created_at: string;
  job_description: string;
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
  
  // Report type state
  const [reportType, setReportType] = useState<ReportType>(isSimpleMode ? 'field' : 'daily');
  const [weeklySourceMode, setWeeklySourceMode] = useState<WeeklySourceMode>('auto');
  const [availableDailyReports, setAvailableDailyReports] = useState<DailyReport[]>([]);
  const [selectedDailyReportIds, setSelectedDailyReportIds] = useState<string[]>([]);
  const [isLoadingDailyReports, setIsLoadingDailyReports] = useState(false);
  const [availableWeeklyReports, setAvailableWeeklyReports] = useState<DailyReport[]>([]);
  const [selectedWeeklyReportIds, setSelectedWeeklyReportIds] = useState<string[]>([]);
  const [isLoadingWeeklyReports, setIsLoadingWeeklyReports] = useState(false);
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

  // Fetch daily reports when weekly mode is selected
  useEffect(() => {
    if (reportType === 'weekly') {
      fetchDailyReports();
    } else if (reportType === 'monthly') {
      fetchWeeklyReports();
    }
  }, [reportType]);

  // Auto-select reports when auto mode is selected
  useEffect(() => {
    if (weeklySourceMode === 'auto') {
      if (reportType === 'weekly' && availableDailyReports.length > 0) {
        setSelectedDailyReportIds(availableDailyReports.map(r => r.id));
      } else if (reportType === 'monthly' && availableWeeklyReports.length > 0) {
        setSelectedWeeklyReportIds(availableWeeklyReports.map(r => r.id));
      }
    } else if (weeklySourceMode === 'fresh') {
      setSelectedDailyReportIds([]);
      setSelectedWeeklyReportIds([]);
    }
  }, [weeklySourceMode, availableDailyReports, availableWeeklyReports, reportType]);

  const fetchDailyReports = async () => {
    setIsLoadingDailyReports(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get daily reports from the current week
      const startOfWeek = new Date();
      startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
      startOfWeek.setHours(0, 0, 0, 0);

      const { data, error } = await supabase
        .from('reports')
        .select('id, project_name, created_at, job_description, report_type')
        .eq('user_id', user.id)
        .eq('report_type', 'daily')
        .gte('created_at', startOfWeek.toISOString())
        .order('created_at', { ascending: false });

      if (!error && data) {
        setAvailableDailyReports(data);
        if (weeklySourceMode === 'auto') {
          setSelectedDailyReportIds(data.map(r => r.id));
        }
      }
    } catch (error) {
      console.error('Error fetching daily reports:', error);
    } finally {
      setIsLoadingDailyReports(false);
    }
  };

  const fetchWeeklyReports = async () => {
    setIsLoadingWeeklyReports(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get weekly reports from the current month
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const { data, error } = await supabase
        .from('reports')
        .select('id, project_name, created_at, job_description, report_type')
        .eq('user_id', user.id)
        .eq('report_type', 'weekly')
        .gte('created_at', startOfMonth.toISOString())
        .order('created_at', { ascending: false });

      if (!error && data) {
        setAvailableWeeklyReports(data);
        if (weeklySourceMode === 'auto') {
          setSelectedWeeklyReportIds(data.map(r => r.id));
        }
      }
    } catch (error) {
      console.error('Error fetching weekly reports:', error);
    } finally {
      setIsLoadingWeeklyReports(false);
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
      // Get included daily reports content for weekly mode
      let includedDailyReports: string[] = [];
      if (reportType === 'weekly' && weeklySourceMode !== 'fresh' && selectedDailyReportIds.length > 0) {
        includedDailyReports = availableDailyReports
          .filter(r => selectedDailyReportIds.includes(r.id))
          .map(r => r.job_description);
      }

      // Get included weekly reports content for monthly mode
      let includedWeeklyReports: string[] = [];
      if (reportType === 'monthly' && weeklySourceMode !== 'fresh' && selectedWeeklyReportIds.length > 0) {
        includedWeeklyReports = availableWeeklyReports
          .filter(r => selectedWeeklyReportIds.includes(r.id))
          .map(r => r.job_description);
      }

      // Get image data URLs for the AI
      const imageDataUrls = capturedImages.map((img: any) => img.url);

      const { data, error } = await supabase.functions.invoke('generate-report-summary', {
        body: {
          description: initialSummary,
          imageDataUrls,
          reportType,
          includedDailyReports: includedDailyReports.length > 0 ? includedDailyReports : undefined,
          includedWeeklyReports: includedWeeklyReports.length > 0 ? includedWeeklyReports : undefined
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
            
            // Save to media table with GPS data
            const { error: mediaError } = await supabase
              .from('media')
              .insert({
                user_id: user.id,
                report_id: currentReportId,
                file_path: storagePath,
                file_type: 'image',
                mime_type: 'image/jpeg',
                latitude: image.latitude,
                longitude: image.longitude,
                captured_at: image.capturedAt || new Date().toISOString(),
                location_name: image.locationName
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
            weeklySourceMode={weeklySourceMode}
            onWeeklySourceModeChange={setWeeklySourceMode}
            availableDailyReports={availableDailyReports}
            selectedDailyReportIds={selectedDailyReportIds}
            onDailyReportSelectionChange={setSelectedDailyReportIds}
            isLoadingDailyReports={isLoadingDailyReports}
            availableWeeklyReports={availableWeeklyReports}
            selectedWeeklyReportIds={selectedWeeklyReportIds}
            onWeeklyReportSelectionChange={setSelectedWeeklyReportIds}
            isLoadingWeeklyReports={isLoadingWeeklyReports}
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
