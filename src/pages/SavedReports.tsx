import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { BackButton } from "@/components/BackButton";
import { SettingsButton } from "@/components/SettingsButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Download, Trash2, FileText, Cloud, Search, Filter } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { formatDateTime } from '@/lib/dateFormat';

interface SavedReport {
  id: string;
  file_name: string;
  file_path: string;
  file_size: number | null;
  created_at: string;
  report_id: string;
}

const SavedReports = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [reports, setReports] = useState<SavedReport[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"recent" | "name" | "size">("recent");
  const [isLoading, setIsLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedReport, setSelectedReport] = useState<SavedReport | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    loadSavedReports();
  }, []);

  const loadSavedReports = async () => {
    try {
      setIsLoading(true);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Please sign in to view saved reports");
        navigate("/auth");
        return;
      }

      const { data, error } = await supabase
        .from("documents")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error loading reports:", error);
        toast.error("Failed to load reports");
        return;
      }

      setReports(data || []);
    } catch (error) {
      console.error("Error:", error);
      toast.error("An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = async (report: SavedReport, e: React.MouseEvent) => {
    e.stopPropagation();
    
    try {
      toast("Downloading...", { description: "Your report is being downloaded" });

      const { data, error } = await supabase.storage
        .from("documents")
        .download(report.file_path);

      if (error) {
        console.error("Download error:", error);
        toast.error("Download failed");
        return;
      }

      // Create download link
      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = report.file_name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success("Download complete");
    } catch (error) {
      console.error("Download error:", error);
      toast.error("Download failed");
    }
  };

  const handleDeleteClick = (report: SavedReport, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedReport(report);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!selectedReport) return;

    try {
      setIsDeleting(true);

      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from("documents")
        .remove([selectedReport.file_path]);

      if (storageError) {
        console.error("Storage delete error:", storageError);
        toast.error("Delete failed");
        return;
      }

      // Delete from database
      const { error: dbError } = await supabase
        .from("documents")
        .delete()
        .eq("id", selectedReport.id);

      if (dbError) {
        console.error("Database delete error:", dbError);
        toast.error("Delete failed");
        return;
      }

      toast.success("Report deleted");
      loadSavedReports();
    } catch (error) {
      console.error("Delete error:", error);
      toast.error("Delete failed");
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
      setSelectedReport(null);
    }
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "Unknown size";
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(2)} MB`;
  };

  const formatDateDisplay = (dateString: string) => {
    return formatDateTime(dateString);
  };

  // Highlight matching text
  const highlightText = (text: string, query: string) => {
    if (!query.trim()) return text;
    
    const parts = text.split(new RegExp(`(${query})`, 'gi'));
    return (
      <>
        {parts.map((part, index) => 
          part.toLowerCase() === query.toLowerCase() ? (
            <mark key={index} className="bg-primary/30 text-foreground rounded px-0.5">
              {part}
            </mark>
          ) : (
            part
          )
        )}
      </>
    );
  };

  // Filter and sort reports
  const filteredReports = reports
    .filter((report) => {
      const searchLower = searchQuery.toLowerCase();
      return report.file_name.toLowerCase().includes(searchLower);
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "name":
          return a.file_name.localeCompare(b.file_name);
        case "size":
          return (b.file_size || 0) - (a.file_size || 0);
        case "recent":
        default:
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });

  if (isLoading) {
    return (
      <div className="dark min-h-screen bg-background">
        <div className="flex min-h-screen items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="dark min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/80 px-4 py-1 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <BackButton />
          <h1 className="text-lg font-semibold text-foreground flex-1 text-center">{t('savedReports.title')}</h1>
          <SettingsButton />
        </div>
      </header>

      <main className="p-4">
        {/* Search and Filter - Always visible */}
        <div className="mb-4 flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder={t('savedReports.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-card border-border text-foreground placeholder:text-muted-foreground"
            />
          </div>
          <Select value={sortBy} onValueChange={(value: "recent" | "name" | "size") => setSortBy(value)}>
            <SelectTrigger className="w-full sm:w-[180px] bg-card border-border text-foreground">
              <Filter className="mr-2 h-4 w-4" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="recent">{t('savedReports.sortRecent')}</SelectItem>
              <SelectItem value="name">{t('savedReports.sortName')}</SelectItem>
              <SelectItem value="size">{t('savedReports.sortSize')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        {/* Reports List */}
        {reports.length === 0 ? (
          <div className="rounded-lg bg-card p-8 text-center">
            <Cloud className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <p className="text-muted-foreground">{t('savedReports.emptyState')}</p>
          </div>
        ) : filteredReports.length === 0 ? (
          <div className="rounded-lg bg-card p-8 text-center">
            <Search className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <p className="text-muted-foreground">No reports found matching "{searchQuery}"</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredReports.map((report) => (
              <div
                key={report.id}
                className="flex items-start gap-4 rounded-lg bg-card p-4 hover:bg-secondary/50 transition-colors cursor-pointer"
                onClick={() => handleDownload(report, { stopPropagation: () => {} } as React.MouseEvent)}
              >
                <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <FileText className="h-7 w-7 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-foreground text-lg mb-1 truncate">
                    {highlightText(report.file_name, searchQuery)}
                  </h3>
                  <div className="space-y-1 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Cloud className="h-4 w-4 flex-shrink-0" />
                      <span className="truncate">{formatDateDisplay(report.created_at)}</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <FileText className="h-4 w-4 flex-shrink-0" />
                      <span>{formatFileSize(report.file_size)}</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => handleDownload(report, e)}
                    className="text-primary hover:text-primary hover:bg-primary/10"
                  >
                    <Download className="h-5 w-5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => handleDeleteClick(report, e)}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-5 w-5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Delete Report?</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Are you sure you want to delete "{selectedReport?.file_name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default SavedReports;
