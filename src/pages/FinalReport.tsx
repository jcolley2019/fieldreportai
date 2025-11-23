import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { BackButton } from "@/components/BackButton";
import { Building2, Download, Share2, ChevronRight, Edit2, Save, X, Link2, FileText } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { RichTextEditor } from "@/components/RichTextEditor";
import { pdf } from '@react-pdf/renderer';
import { ReportPDF } from '@/components/ReportPDF';

interface MediaItem {
  id: string;
  file_path: string;
  file_type: string;
}

interface ChecklistItem {
  id: string;
  text: string;
  completed: boolean;
  priority: string;
  category: string;
}

interface Checklist {
  id: string;
  title: string;
  items: ChecklistItem[];
}

const FinalReport = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const reportId = location.state?.reportId;
  const [reportData, setReportData] = useState<any>(location.state?.reportData || null);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [isLoading, setIsLoading] = useState(!reportData);
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [editedContent, setEditedContent] = useState<{ [key: string]: string }>({});
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const loadReportData = async () => {
      if (!reportId) {
        console.error("No reportId found in location state");
        toast({
          title: "No report found",
          variant: "destructive",
        });
        setIsLoading(false);
        // Don't navigate away - stay on page and show error
        return;
      }

      try {
        setIsLoading(true);

        // Fetch report data
        const { data: report, error: reportError } = await supabase
          .from('reports')
          .select('*')
          .eq('id', reportId)
          .single();

        if (reportError || !report) {
          console.error("Failed to load report:", reportError);
          toast({
            title: "Failed to load report",
            variant: "destructive",
          });
          setIsLoading(false);
          return;
        }

        setReportData(report);

        // Fetch media
        const { data: mediaData, error: mediaError } = await supabase
          .from('media')
          .select('*')
          .eq('report_id', reportId)
          .order('created_at', { ascending: false });

        if (!mediaError && mediaData) {
          setMedia(mediaData);
        }

        // Fetch checklists with items
        const { data: checklistsData, error: checklistsError } = await supabase
          .from('checklists')
          .select('*')
          .eq('report_id', reportId)
          .order('created_at', { ascending: false });

        if (!checklistsError && checklistsData) {
          const checklistsWithItems = await Promise.all(
            checklistsData.map(async (checklist) => {
              const { data: itemsData } = await supabase
                .from('checklist_items')
                .select('*')
                .eq('checklist_id', checklist.id)
                .order('created_at', { ascending: false });

              return {
                ...checklist,
                items: itemsData || []
              };
            })
          );
          setChecklists(checklistsWithItems);
        }

      } catch (error) {
        console.error('Error loading report data:', error);
        toast({
          title: "Failed to load report",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadReportData();
  }, [reportId]);

  if (isLoading) {
    return (
      <div className="dark min-h-screen bg-background flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  if (!reportData) {
    return (
      <div className="dark min-h-screen bg-background">
        <header className="sticky top-0 z-10 w-full border-b border-border bg-background/80 backdrop-blur-sm">
          <div className="flex h-12 items-center p-4">
            <BackButton />
          </div>
        </header>
        <div className="flex flex-col items-center justify-center p-8 text-center">
          <Building2 className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
          <h2 className="text-xl font-bold text-foreground mb-2">No Report Found</h2>
          <p className="text-muted-foreground mb-4">
            The report could not be loaded. Please try again or go back to the dashboard.
          </p>
          <Button onClick={() => navigate("/dashboard")}>
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  const handleDownloadPDF = async () => {
    try {
      toast({
        title: "Generating PDF...",
        description: "Your report is being prepared as a PDF file.",
      });

      // Fetch media URLs if there are media items
      const mediaUrlsMap = new Map<string, string>();
      for (const item of media) {
        if (item.file_type === 'image') {
          const { data } = supabase.storage.from('media').getPublicUrl(item.file_path);
          mediaUrlsMap.set(item.id, data.publicUrl);
        }
      }

      // Generate PDF
      const blob = await pdf(
        <ReportPDF
          reportData={reportData}
          media={media}
          checklists={checklists}
          mediaUrls={mediaUrlsMap}
        />
      ).toBlob();

      // Create download link
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${reportData?.project_name || 'Report'}_${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: "PDF Downloaded!",
        description: "Your report has been saved as a PDF file.",
      });
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast({
        title: "Failed to generate PDF",
        description: "Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleDownloadWord = () => {
    toast({
      title: "Downloading Word Document...",
      description: "Your report is being prepared as a Word document.",
    });
    // TODO: Implement actual Word document generation
  };

  const handleCopyLink = async () => {
    try {
      const url = window.location.href;
      await navigator.clipboard.writeText(url);
      toast({
        title: "Link copied!",
        description: "Report link has been copied to clipboard.",
      });
    } catch (err) {
      toast({
        title: "Failed to copy link",
        description: "Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleShare = () => {
    toast({
      title: "Sharing report...",
      description: "Opening share options.",
    });
    navigate("/confirmation");
  };

  const handleForward = () => {
    toast({
      title: "Forwarding report...",
      description: "Preparing to forward this report.",
    });
  };

  const getMediaUrl = (filePath: string) => {
    const { data } = supabase.storage.from('media').getPublicUrl(filePath);
    return data.publicUrl;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const handleEditSection = (sectionKey: string, content: string) => {
    setEditingSection(sectionKey);
    setEditedContent({ ...editedContent, [sectionKey]: content });
  };

  const handleCancelEdit = () => {
    setEditingSection(null);
    setEditedContent({});
  };

  const handleSaveSection = async (sectionKey: string) => {
    if (!reportId || !reportData) return;

    setIsSaving(true);
    try {
      const text = reportData.job_description;
      let updatedText = text;

      // Update the specific section in the full text
      if (sectionKey === 'summary') {
        updatedText = text.replace(
          /SUMMARY:\s*([\s\S]*?)(?=KEY POINTS:|ACTION ITEMS:|$)/i,
          `SUMMARY:\n${editedContent[sectionKey]}\n\n`
        );
      } else if (sectionKey === 'keypoints') {
        updatedText = text.replace(
          /KEY POINTS:\s*([\s\S]*?)(?=ACTION ITEMS:|$)/i,
          `KEY POINTS:\n${editedContent[sectionKey]}\n\n`
        );
      } else if (sectionKey === 'actions') {
        updatedText = text.replace(
          /ACTION ITEMS:\s*([\s\S]*?)$/i,
          `ACTION ITEMS:\n${editedContent[sectionKey]}`
        );
      }

      const { error } = await supabase
        .from('reports')
        .update({ job_description: updatedText })
        .eq('id', reportId);

      if (error) throw error;

      setReportData({ ...reportData, job_description: updatedText });
      setEditingSection(null);
      setEditedContent({});
      toast({
        title: "Section updated successfully",
      });
    } catch (error) {
      console.error('Error updating section:', error);
      toast({
        title: "Failed to update section",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="dark min-h-screen bg-background">
      {/* Sticky Header */}
      <header className="sticky top-0 z-10 w-full border-b border-border bg-background/80 backdrop-blur-sm">
        <div className="flex flex-col gap-2 p-4 pb-3">
          <div className="flex h-12 items-center justify-between">
            <BackButton />
            <div className="flex w-auto items-center justify-end">
              <p className="shrink-0 text-sm font-medium text-muted-foreground">
                {reportData?.created_at ? formatDate(reportData.created_at) : 'N/A'}
              </p>
            </div>
          </div>
          <p className="text-2xl font-bold leading-tight tracking-tight text-foreground">
            {reportData?.project_name || 'Report'}
          </p>
          <p className="text-sm text-muted-foreground">
            {reportData?.customer_name} • Job #{reportData?.job_number}
          </p>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow pb-64">{/* Increased padding to account for cloud storage section and action bar */}
        <div className="pt-6">
          <h1 className="px-4 pb-3 text-left text-[32px] font-bold leading-tight tracking-tight text-foreground">
            Report Summary
          </h1>

          {/* Display formatted report summary */}
          {reportData?.job_description && (
            <div className="px-4 pb-6">
              {(() => {
                const text = reportData.job_description;
                
                // Parse Summary section
                const summaryMatch = text.match(/SUMMARY:\s*([\s\S]*?)(?=KEY POINTS:|ACTION ITEMS:|$)/i);
                const keyPointsMatch = text.match(/KEY POINTS:\s*([\s\S]*?)(?=ACTION ITEMS:|$)/i);
                const actionItemsMatch = text.match(/ACTION ITEMS:\s*([\s\S]*?)$/i);
                
                return (
                  <div className="space-y-4">
                    {summaryMatch && (
                      <div className="rounded-lg bg-card p-4">
                        <div className="flex items-center justify-between mb-2">
                          <h2 className="text-lg font-bold text-foreground">Summary</h2>
                          {editingSection !== 'summary' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditSection('summary', summaryMatch[1].trim())}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                        {editingSection === 'summary' ? (
                          <div className="space-y-2">
                            <RichTextEditor
                              content={editedContent['summary'] || ''}
                              onChange={(content) => setEditedContent({ ...editedContent, summary: content })}
                            />
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={() => handleSaveSection('summary')}
                                disabled={isSaving}
                              >
                                <Save className="h-4 w-4 mr-1" />
                                {isSaving ? 'Saving...' : 'Save'}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={handleCancelEdit}
                                disabled={isSaving}
                              >
                                <X className="h-4 w-4 mr-1" />
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div 
                            className="prose prose-sm max-w-none text-base leading-relaxed text-muted-foreground"
                            dangerouslySetInnerHTML={{ __html: summaryMatch[1].trim() }}
                          />
                        )}
                      </div>
                    )}
                    
                    {keyPointsMatch && (
                      <div className="rounded-lg bg-card p-4">
                        <div className="flex items-center justify-between mb-2">
                          <h2 className="text-lg font-bold text-foreground">Key Points</h2>
                          {editingSection !== 'keypoints' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditSection('keypoints', keyPointsMatch[1].trim())}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                        {editingSection === 'keypoints' ? (
                          <div className="space-y-2">
                            <RichTextEditor
                              content={editedContent['keypoints'] || ''}
                              onChange={(content) => setEditedContent({ ...editedContent, keypoints: content })}
                            />
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={() => handleSaveSection('keypoints')}
                                disabled={isSaving}
                              >
                                <Save className="h-4 w-4 mr-1" />
                                {isSaving ? 'Saving...' : 'Save'}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={handleCancelEdit}
                                disabled={isSaving}
                              >
                                <X className="h-4 w-4 mr-1" />
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div 
                            className="prose prose-sm max-w-none text-base leading-relaxed text-muted-foreground"
                            dangerouslySetInnerHTML={{ __html: keyPointsMatch[1].trim() }}
                          />
                        )}
                      </div>
                    )}
                    
                    {actionItemsMatch && (
                      <div className="rounded-lg bg-card p-4">
                        <div className="flex items-center justify-between mb-2">
                          <h2 className="text-lg font-bold text-foreground">Action Items</h2>
                          {editingSection !== 'actions' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditSection('actions', actionItemsMatch[1].trim())}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                        {editingSection === 'actions' ? (
                          <div className="space-y-2">
                            <RichTextEditor
                              content={editedContent['actions'] || ''}
                              onChange={(content) => setEditedContent({ ...editedContent, actions: content })}
                            />
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={() => handleSaveSection('actions')}
                                disabled={isSaving}
                              >
                                <Save className="h-4 w-4 mr-1" />
                                {isSaving ? 'Saving...' : 'Save'}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={handleCancelEdit}
                                disabled={isSaving}
                              >
                                <X className="h-4 w-4 mr-1" />
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div 
                            className="prose prose-sm max-w-none text-base leading-relaxed text-muted-foreground"
                            dangerouslySetInnerHTML={{ __html: actionItemsMatch[1].trim() }}
                          />
                        )}
                      </div>
                    )}
                    
                    {!summaryMatch && !keyPointsMatch && !actionItemsMatch && (
                      <div className="rounded-lg bg-card p-4">
                        <p className="text-base leading-relaxed text-muted-foreground whitespace-pre-line">
                          {text}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}

          {/* Photos Section */}
          {media.length > 0 && (
            <div className="px-4 pb-8">
              <h2 className="pb-4 text-2xl font-bold text-foreground">
                Photos & Media ({media.length})
              </h2>
              <div className="grid grid-cols-2 gap-3">
                {media.slice(0, 6).map((item) => (
                  <div key={item.id} className="aspect-square overflow-hidden rounded-xl bg-muted">
                    {item.file_type === 'image' ? (
                      <img
                        src={getMediaUrl(item.file_path)}
                        alt="Project media"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5">
                        <p className="text-sm text-muted-foreground">Video</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {media.length > 6 && (
                <p className="mt-3 text-sm text-muted-foreground">
                  + {media.length - 6} more photo{media.length - 6 !== 1 ? 's' : ''}
                </p>
              )}
            </div>
          )}

          {/* Checklists Section */}
          {checklists.map((checklist) => (
            <div key={checklist.id} className="px-4 pb-8">
              <h2 className="pb-2 text-2xl font-bold text-foreground">
                {checklist.title}
              </h2>
              <div className="space-y-3">
                {checklist.items.map((item) => (
                  <div key={item.id} className="flex items-start gap-3 rounded-lg bg-card p-3">
                    <div className={`mt-0.5 h-5 w-5 rounded border-2 flex-shrink-0 ${
                      item.completed ? 'bg-primary border-primary' : 'border-muted-foreground'
                    }`}>
                      {item.completed && (
                        <svg className="h-full w-full text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <div className="flex-1">
                      <p className={`text-base leading-relaxed ${
                        item.completed ? 'line-through text-muted-foreground' : 'text-foreground'
                      }`}>
                        {item.text}
                      </p>
                      <div className="mt-1 flex items-center gap-2">
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          item.priority === 'high' ? 'bg-destructive/20 text-destructive' :
                          item.priority === 'medium' ? 'bg-primary/20 text-primary' :
                          'bg-secondary text-muted-foreground'
                        }`}>
                          {item.priority}
                        </span>
                        <span className="text-xs text-muted-foreground">{item.category}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Project Details Section */}
          <div className="px-4 pb-8">
            <h2 className="pb-2 text-2xl font-bold text-foreground">
              Project Information
            </h2>
            <div className="space-y-2 rounded-lg bg-card p-4">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Customer:</span>
                <span className="font-medium text-foreground">{reportData?.customer_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Job Number:</span>
                <span className="font-medium text-foreground">{reportData?.job_number}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Created:</span>
                <span className="font-medium text-foreground">
                  {reportData?.created_at ? formatDate(reportData.created_at) : 'N/A'}
                </span>
              </div>
            </div>
          </div>

          {/* Empty State */}
          {media.length === 0 && checklists.length === 0 && (
            <div className="px-4 pb-8">
              <div className="rounded-lg bg-card p-8 text-center">
                <Building2 className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                <p className="text-muted-foreground">
                  No photos or checklists have been added to this report yet.
                </p>
              </div>
            </div>
          )}

          {/* Cloud Storage Options */}
          <div className="px-4 pb-8">
            <h3 className="mb-4 text-base font-medium text-muted-foreground">
              Also send to
            </h3>
            <div className="grid grid-cols-3 gap-4">
              <button
                onClick={() => toast({ title: "Sending to Google Drive..." })}
                className="flex flex-col items-center gap-3 rounded-xl bg-card p-4 transition-colors hover:bg-secondary"
              >
                <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-muted text-3xl">
                  📄
                </div>
                <span className="text-sm font-medium text-foreground">
                  Google Drive
                </span>
              </button>
              <button
                onClick={() => toast({ title: "Sending to OneDrive..." })}
                className="flex flex-col items-center gap-3 rounded-xl bg-card p-4 transition-colors hover:bg-secondary"
              >
                <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-muted text-3xl">
                  📁
                </div>
                <span className="text-sm font-medium text-foreground">
                  OneDrive
                </span>
              </button>
              <button
                onClick={() => toast({ title: "Sending to Dropbox..." })}
                className="flex flex-col items-center gap-3 rounded-xl bg-card p-4 transition-colors hover:bg-secondary"
              >
                <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-muted text-3xl">
                  📦
                </div>
                <span className="text-sm font-medium text-foreground">
                  Dropbox
                </span>
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Bottom Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-border bg-background/80 p-4 backdrop-blur-sm">
        <div className="mb-3 grid grid-cols-2 gap-3">
          <Button
            onClick={handleDownloadPDF}
            className="bg-primary py-6 text-base font-semibold text-primary-foreground hover:bg-primary/90"
          >
            <Download className="mr-2 h-5 w-5" />
            Save as PDF
          </Button>
          <Button
            onClick={handleDownloadWord}
            variant="secondary"
            className="py-6 text-base font-semibold"
          >
            <FileText className="mr-2 h-5 w-5" />
            Save as Word
          </Button>
        </div>
        <div className="mb-3 flex gap-3">
          <Button
            onClick={handleCopyLink}
            variant="outline"
            className="flex-1 py-6 text-base font-semibold"
          >
            <Link2 className="mr-2 h-5 w-5" />
            Copy Link
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
          Report generated on {reportData?.created_at ? new Date(reportData.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'N/A'}
        </p>
      </div>
    </div>
  );
};

export default FinalReport;
