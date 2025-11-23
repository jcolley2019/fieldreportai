import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { BackButton } from "@/components/BackButton";
import { Building2, Download, Share2, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

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

  useEffect(() => {
    const loadReportData = async () => {
      if (!reportId) {
        toast.error("No report found");
        navigate("/dashboard");
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
          toast.error("Failed to load report");
          navigate("/dashboard");
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
        toast.error('Failed to load report');
      } finally {
        setIsLoading(false);
      }
    };

    loadReportData();
  }, [reportId, navigate]);

  if (isLoading) {
    return (
      <div className="dark min-h-screen bg-background flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  const handleDownloadPDF = () => {
    toast.success("Downloading PDF...");
    navigate("/confirmation");
  };

  const handleShare = () => {
    toast.success("Sharing report...");
    navigate("/confirmation");
  };

  const handleForward = () => {
    toast.success("Forwarding report...");
  };

  const getMediaUrl = (filePath: string) => {
    const { data } = supabase.storage.from('media').getPublicUrl(filePath);
    return data.publicUrl;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
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
      <main className="flex-grow pb-40">
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
                        <h2 className="mb-2 text-lg font-bold text-foreground">Summary</h2>
                        <p className="text-base leading-relaxed text-muted-foreground whitespace-pre-line">
                          {summaryMatch[1].trim()}
                        </p>
                      </div>
                    )}
                    
                    {keyPointsMatch && (
                      <div className="rounded-lg bg-card p-4">
                        <h2 className="mb-2 text-lg font-bold text-foreground">Key Points</h2>
                        <p className="text-base leading-relaxed text-muted-foreground whitespace-pre-line">
                          {keyPointsMatch[1].trim()}
                        </p>
                      </div>
                    )}
                    
                    {actionItemsMatch && (
                      <div className="rounded-lg bg-card p-4">
                        <h2 className="mb-2 text-lg font-bold text-foreground">Action Items</h2>
                        <p className="text-base leading-relaxed text-muted-foreground whitespace-pre-line">
                          {actionItemsMatch[1].trim()}
                        </p>
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
          Report generated on {reportData?.created_at ? new Date(reportData.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'N/A'}
        </p>
      </div>
    </div>
  );
};

export default FinalReport;
