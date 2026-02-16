import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { BackButton } from "@/components/BackButton";
import { SettingsButton } from "@/components/SettingsButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { GlassNavbar, NavbarLeft, NavbarCenter, NavbarRight, NavbarTitle } from "@/components/GlassNavbar";
import { toast } from "sonner";
import { Download, Trash2, FileText, Cloud, Search, Filter, Calendar, CalendarDays, MapPin, Mail, Send, Loader2, X, CheckSquare, Square } from "lucide-react";
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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { formatDateTime } from '@/lib/dateFormat';
import JSZip from 'jszip';

interface SavedReport {
  id: string;
  file_name: string;
  file_path: string;
  file_size: number | null;
  created_at: string;
  report_id: string;
  report_type?: string | null;
}

const SavedReports = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [reports, setReports] = useState<SavedReport[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"recent" | "name" | "size">("recent");
  const [filterType, setFilterType] = useState<"all" | "field" | "daily" | "weekly" | "monthly" | "site_survey">("all");
  const [isLoading, setIsLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedReport, setSelectedReport] = useState<SavedReport | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Selection and email state
  const [selectedReports, setSelectedReports] = useState<Set<string>>(new Set());
  const [selectionMode, setSelectionMode] = useState(false);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [emailMessage, setEmailMessage] = useState("");
  const [sendingEmail, setSendingEmail] = useState(false);

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

      // Fetch documents with their associated report's report_type
      const { data: documents, error: docError } = await supabase
        .from("documents")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (docError) {
        console.error("Error loading reports:", docError);
        toast.error("Failed to load reports");
        return;
      }

      // Fetch report types for all documents
      if (documents && documents.length > 0) {
        const reportIds = [...new Set(documents.map(d => d.report_id))];
        const { data: reports, error: reportError } = await supabase
          .from("reports")
          .select("id, report_type")
          .in("id", reportIds);

        if (!reportError && reports) {
          const reportTypeMap = new Map(reports.map(r => [r.id, r.report_type]));
          const enrichedDocuments = documents.map(doc => ({
            ...doc,
            report_type: reportTypeMap.get(doc.report_id) || null
          }));
          setReports(enrichedDocuments);
        } else {
          setReports(documents);
        }
      } else {
        setReports(documents || []);
      }
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

  // Get report type badge info
  const getReportTypeBadge = (reportType: string | null | undefined) => {
    switch (reportType) {
      case 'field':
        return {
          label: t('reportType.field', 'Field Report'),
          icon: FileText,
          className: 'bg-orange-500/20 text-orange-400 border-orange-500/30'
        };
      case 'daily':
        return {
          label: t('reportType.daily', 'Daily Report'),
          icon: Calendar,
          className: 'bg-blue-500/20 text-blue-400 border-blue-500/30'
        };
      case 'weekly':
        return {
          label: t('reportType.weekly', 'Weekly Report'),
          icon: CalendarDays,
          className: 'bg-purple-500/20 text-purple-400 border-purple-500/30'
        };
      case 'monthly':
        return {
          label: t('reportType.monthly', 'Monthly Report'),
          icon: CalendarDays,
          className: 'bg-amber-500/20 text-amber-400 border-amber-500/30'
        };
      case 'site_survey':
        return {
          label: t('reportType.siteSurvey', 'Site Survey'),
          icon: MapPin,
          className: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
        };
      default:
        return null;
    }
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
      const matchesSearch = report.file_name.toLowerCase().includes(searchLower);
      const matchesType = filterType === "all" || report.report_type === filterType;
      return matchesSearch && matchesType;
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

  const toggleReportSelection = (reportId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newSelected = new Set(selectedReports);
    if (newSelected.has(reportId)) {
      newSelected.delete(reportId);
    } else {
      newSelected.add(reportId);
    }
    setSelectedReports(newSelected);
    if (newSelected.size === 0) {
      setSelectionMode(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedReports.size === filteredReports.length) {
      setSelectedReports(new Set());
      setSelectionMode(false);
    } else {
      setSelectedReports(new Set(filteredReports.map(r => r.id)));
    }
  };

  const cancelSelection = () => {
    setSelectedReports(new Set());
    setSelectionMode(false);
  };

  const handleBulkEmail = async () => {
    if (!recipientEmail || selectedReports.size === 0) {
      toast.error('Please enter a recipient email');
      return;
    }

    setSendingEmail(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name, first_name, last_name, company_name')
        .eq('id', user.id)
        .single();

      const senderName = profile?.display_name || 
        `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim() || 
        'Field Report User';

      // Download selected reports and create ZIP
      const selectedReportsData = reports.filter(r => selectedReports.has(r.id));
      const zip = new JSZip();

      for (const report of selectedReportsData) {
        const { data, error } = await supabase.storage
          .from('documents')
          .download(report.file_path);

        if (!error && data) {
          zip.file(report.file_name, data);
        }
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      
      // Convert to base64
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onloadend = () => {
          const base64 = (reader.result as string).split(',')[1];
          resolve(base64);
        };
      });
      reader.readAsDataURL(zipBlob);
      const base64Data = await base64Promise;

      // Send email
      const { error } = await supabase.functions.invoke('send-export-email', {
        body: {
          recipientEmail,
          recipientName: recipientName || undefined,
          senderName,
          subject: `Saved Reports (${selectedReports.size} reports)`,
          message: emailMessage || undefined,
          fileData: base64Data,
          fileName: `Saved_Reports_${new Date().toISOString().split('T')[0]}.zip`,
          fileSize: zipBlob.size,
        },
      });

      if (error) throw error;

      toast.success(`Email sent with ${selectedReports.size} reports`);
      setEmailDialogOpen(false);
      setRecipientEmail("");
      setRecipientName("");
      setEmailMessage("");
      cancelSelection();
    } catch (error) {
      console.error('Error sending email:', error);
      toast.error('Failed to send email');
    } finally {
      setSendingEmail(false);
    }
  };

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
      {/* Glass Navbar */}
      <GlassNavbar fixed={false}>
        <NavbarLeft>
          <BackButton />
        </NavbarLeft>
        <NavbarCenter>
          <NavbarTitle>{t('savedReports.title')}</NavbarTitle>
        </NavbarCenter>
        <NavbarRight>
          <SettingsButton />
        </NavbarRight>
      </GlassNavbar>

      <main className="p-4 animate-fade-in">
        {/* Bulk Actions Bar */}
        {selectionMode && selectedReports.size > 0 && (
          <div className="mb-4 flex items-center justify-between rounded-lg bg-primary/10 p-3 border border-primary/20">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={cancelSelection}
                className="gap-1"
              >
                <X className="h-4 w-4" />
                Cancel
              </Button>
              <span className="text-sm text-foreground">
                {selectedReports.size} selected
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleSelectAll}
                className="gap-1"
              >
                {selectedReports.size === filteredReports.length ? (
                  <>
                    <Square className="h-4 w-4" />
                    Deselect All
                  </>
                ) : (
                  <>
                    <CheckSquare className="h-4 w-4" />
                    Select All
                  </>
                )}
              </Button>
            </div>
            <Button
              size="sm"
              onClick={() => setEmailDialogOpen(true)}
              className="gap-2"
            >
              <Mail className="h-4 w-4" />
              Email Selected
            </Button>
          </div>
        )}

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
          <div className="flex gap-2">
            {!selectionMode && reports.length > 0 && (
              <Button
                variant="outline"
                size="icon"
                onClick={() => setSelectionMode(true)}
                className="flex-shrink-0"
                title="Select reports"
              >
                <CheckSquare className="h-4 w-4" />
              </Button>
            )}
            <Select value={filterType} onValueChange={(value: "all" | "field" | "daily" | "weekly" | "monthly" | "site_survey") => setFilterType(value)}>
              <SelectTrigger className="w-full sm:w-[160px] bg-card border-border text-foreground">
                <SelectValue placeholder={t('savedReports.filterAll')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('savedReports.filterAll')}</SelectItem>
                <SelectItem value="field">{t('reportType.field')}</SelectItem>
                <SelectItem value="daily">{t('reportType.daily')}</SelectItem>
                <SelectItem value="weekly">{t('reportType.weekly')}</SelectItem>
                <SelectItem value="monthly">{t('reportType.monthly')}</SelectItem>
                <SelectItem value="site_survey">{t('reportType.siteSurvey')}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={(value: "recent" | "name" | "size") => setSortBy(value)}>
              <SelectTrigger className="w-full sm:w-[140px] bg-card border-border text-foreground">
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
        </div>
        
        {/* Reports List */}
        <h3 className="mb-4 text-lg font-bold text-foreground">{t('savedReports.title')}</h3>
        <div className="rounded-2xl border border-border/40 bg-card/50 backdrop-blur-sm">
        {reports.length === 0 ? (
          <div className="p-8 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted/50">
              <FileText className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-foreground font-medium mb-1">{t('savedReports.emptyState')}</p>
            <p className="text-sm text-muted-foreground">{t('savedReports.emptyStateHint', { defaultValue: 'Generate a report from a project to see it here' })}</p>
          </div>
        ) : filteredReports.length === 0 ? (
          <div className="p-8 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted/50">
              <Search className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-foreground font-medium mb-1">No reports found</p>
            <p className="text-sm text-muted-foreground">Try a different search term</p>
          </div>
        ) : (
          <div className="divide-y divide-border/30">
            {filteredReports.map((report) => {
              const badgeInfo = getReportTypeBadge(report.report_type);
              const BadgeIcon = badgeInfo?.icon;
              
              return (
                <div
                  key={report.id}
                  onClick={() => selectionMode ? toggleReportSelection(report.id, { stopPropagation: () => {} } as React.MouseEvent) : handleDownload(report, { stopPropagation: () => {} } as React.MouseEvent)}
                  className={`flex items-start gap-4 p-4 hover:bg-muted/20 transition-colors cursor-pointer ${selectedReports.has(report.id) ? 'ring-2 ring-primary bg-primary/5' : ''}`}
                >
                  {selectionMode && (
                    <div 
                      className="flex-shrink-0 pt-1"
                      onClick={(e) => toggleReportSelection(report.id, e)}
                    >
                      <Checkbox
                        checked={selectedReports.has(report.id)}
                        className="h-5 w-5"
                      />
                    </div>
                  )}
                  <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <FileText className="h-7 w-7 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h3 className="font-semibold text-foreground text-lg truncate">
                        {highlightText(report.file_name, searchQuery)}
                      </h3>
                      {badgeInfo && (
                        <Badge 
                          variant="outline" 
                          className={`flex items-center gap-1 text-xs font-medium ${badgeInfo.className}`}
                        >
                          {BadgeIcon && <BadgeIcon className="h-3 w-3" />}
                          <span className="hidden sm:inline">{badgeInfo.label}</span>
                        </Badge>
                      )}
                    </div>
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
                  {!selectionMode && (
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
                  )}
                </div>
              );
            })}
          </div>
        )}
        </div>
        {/* Email Dialog */}
        <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Share Reports via Email</DialogTitle>
              <DialogDescription>
                Send {selectedReports.size} report{selectedReports.size !== 1 ? 's' : ''} as a ZIP file attachment
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="bulkRecipientEmail">Recipient Email *</Label>
                <Input
                  id="bulkRecipientEmail"
                  type="email"
                  placeholder="email@example.com"
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bulkRecipientName">Recipient Name (optional)</Label>
                <Input
                  id="bulkRecipientName"
                  type="text"
                  placeholder="John Doe"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bulkEmailMessage">Message (optional)</Label>
                <Textarea
                  id="bulkEmailMessage"
                  placeholder="Add a personal message..."
                  value={emailMessage}
                  onChange={(e) => setEmailMessage(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setEmailDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleBulkEmail} 
                disabled={sendingEmail || !recipientEmail}
                className="gap-2"
              >
                {sendingEmail ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    Send Email
                  </>
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
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
