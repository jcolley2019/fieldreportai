import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { BackButton } from "@/components/BackButton";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { Download, Trash2, FileText, Cloud } from "lucide-react";
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

interface SavedReport {
  id: string;
  file_name: string;
  file_path: string;
  file_size: number | null;
  created_at: string;
  report_id: string;
}

const SavedReports = () => {
  const navigate = useNavigate();
  const [reports, setReports] = useState<SavedReport[]>([]);
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
        toast({
          title: "Authentication required",
          description: "Please sign in to view saved reports",
          variant: "destructive",
        });
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
        toast({
          title: "Failed to load reports",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      setReports(data || []);
    } catch (error) {
      console.error("Error:", error);
      toast({
        title: "Error loading reports",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = async (report: SavedReport) => {
    try {
      toast({
        title: "Downloading...",
        description: "Your report is being downloaded",
      });

      const { data, error } = await supabase.storage
        .from("documents")
        .download(report.file_path);

      if (error) {
        console.error("Download error:", error);
        toast({
          title: "Download failed",
          description: error.message,
          variant: "destructive",
        });
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

      toast({
        title: "Download complete",
        description: "Your report has been downloaded",
      });
    } catch (error) {
      console.error("Download error:", error);
      toast({
        title: "Download failed",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
    }
  };

  const handleDeleteClick = (report: SavedReport) => {
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
        toast({
          title: "Delete failed",
          description: storageError.message,
          variant: "destructive",
        });
        return;
      }

      // Delete from database
      const { error: dbError } = await supabase
        .from("documents")
        .delete()
        .eq("id", selectedReport.id);

      if (dbError) {
        console.error("Database delete error:", dbError);
        toast({
          title: "Delete failed",
          description: dbError.message,
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Report deleted",
        description: "The report has been removed from your saved reports",
      });

      // Reload reports
      loadSavedReports();
    } catch (error) {
      console.error("Delete error:", error);
      toast({
        title: "Delete failed",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <BackButton />
          <h1 className="text-xl font-bold">Saved Reports</h1>
          <div className="w-20" /> {/* Spacer for centering */}
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6 pb-24">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Cloud className="mb-4 h-16 w-16 animate-pulse text-primary" />
            <p className="text-muted-foreground">Loading saved reports...</p>
          </div>
        ) : reports.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <FileText className="mb-4 h-16 w-16 text-muted-foreground" />
            <h2 className="mb-2 text-xl font-semibold">No saved reports</h2>
            <p className="mb-6 text-center text-muted-foreground">
              Reports you save to cloud will appear here
            </p>
            <Button onClick={() => navigate("/dashboard")}>
              Go to Dashboard
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {reports.map((report) => (
              <Card
                key={report.id}
                className="overflow-hidden transition-transform duration-200 hover:scale-105"
              >
                <div className="p-6">
                  <div className="mb-4 flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="mb-1 font-semibold text-foreground line-clamp-2">
                        {report.file_name}
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(report.created_at)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatFileSize(report.file_size)}
                      </p>
                    </div>
                    <FileText className="h-8 w-8 text-primary" />
                  </div>

                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleDownload(report)}
                      className="flex-1"
                      size="sm"
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Download
                    </Button>
                    <Button
                      onClick={() => handleDeleteClick(report)}
                      variant="destructive"
                      size="sm"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Report?</AlertDialogTitle>
            <AlertDialogDescription>
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
