import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { BackButton } from "@/components/BackButton";
import { SettingsButton } from "@/components/SettingsButton";
import { Input } from "@/components/ui/input";
import { GlassNavbar, NavbarLeft, NavbarCenter, NavbarRight, NavbarTitle } from "@/components/GlassNavbar";
import { Building2, Hash, User as UserIcon, ListChecks, Search, Filter, Plus, Trash2, Mail, Send, Loader2, X, CheckSquare, Square, Tag, Download, Printer, FileText, MessageSquare } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { pdf } from '@react-pdf/renderer';
import { ReportPDF } from '@/components/ReportPDF';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

interface Project {
  id: string;
  project_name: string;
  customer_name: string;
  job_number: string;
  job_description: string;
  created_at: string;
  checklist_count: number;
  tags: string[];
  new_comment_count?: number;
}

const ProjectsCustomers = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [projects, setProjects] = useState<Project[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"recent" | "name" | "customer">("recent");
  const [loading, setLoading] = useState(true);
  const [activeTagFilter, setActiveTagFilter] = useState<string | null>(null);
  
  // Selection and email state
  const [selectedProjects, setSelectedProjects] = useState<Set<string>>(new Set());
  const [selectionMode, setSelectionMode] = useState(false);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [emailMessage, setEmailMessage] = useState("");
  const [sendingEmail, setSendingEmail] = useState(false);

  useEffect(() => {
    fetchProjects();
  }, []);

  // Realtime: increment badge when a new comment arrives
  useEffect(() => {
    const channel = supabase
      .channel('projects-page-photo-comments')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'photo_comments' },
        async (payload) => {
          const newComment = payload.new as { share_token: string; created_at: string };
          const { data: shareData } = await supabase
            .from('project_shares')
            .select('report_id')
            .eq('share_token', newComment.share_token)
            .single();

          if (!shareData) return;
          const reportId = shareData.report_id;
          const lastViewed = localStorage.getItem(`comments_viewed_${reportId}`);
          if (!lastViewed || new Date(newComment.created_at) > new Date(lastViewed)) {
            setProjects((prev) =>
              prev.map((p) =>
                p.id === reportId
                  ? { ...p, new_comment_count: (p.new_comment_count ?? 0) + 1 }
                  : p
              )
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      const { data: reportsData, error: reportsError } = await supabase
        .from('reports')
        .select('*')
        .order('created_at', { ascending: false });

      if (reportsError) throw reportsError;

      // Fetch checklist counts and new comment counts for each report
      const projectsWithCounts = await Promise.all(
        (reportsData || []).map(async (report) => {
          const lastViewed = localStorage.getItem(`comments_viewed_${report.id}`);

          const [checklistResult, sharesResult] = await Promise.all([
            supabase.from('checklists').select('*', { count: 'exact', head: true }).eq('report_id', report.id),
            supabase.from('project_shares').select('share_token').eq('report_id', report.id),
          ]);

          let newCommentCount = 0;
          if (sharesResult.data && sharesResult.data.length > 0) {
            const tokens = sharesResult.data.map((s) => s.share_token);
            let query = supabase.from('photo_comments').select('*', { count: 'exact', head: true }).in('share_token', tokens);
            if (lastViewed) query = query.gt('created_at', lastViewed);
            const { count } = await query;
            newCommentCount = count ?? 0;
          }

          return {
            ...report,
            checklist_count: checklistResult.error ? 0 : (checklistResult.count || 0),
            new_comment_count: newCommentCount,
          };
        })
      );

      setProjects(projectsWithCounts);
    } catch (error) {
      console.error('Error fetching projects:', error);
      toast.error('Failed to load projects');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteProject = async (projectId: string, projectName: string) => {
    if (!confirm(`${t('projects.deleteConfirm')} "${projectName}"? This will also delete all associated checklists and media.`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('reports')
        .delete()
        .eq('id', projectId);

      if (error) throw error;

      toast.success('Project deleted successfully');
      fetchProjects();
    } catch (error) {
      console.error('Error deleting project:', error);
      toast.error('Failed to delete project');
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

  // Collect all unique tags across projects
  const allTags = Array.from(new Set(projects.flatMap(p => p.tags ?? []))).sort();

  // Filter and sort projects
  const filteredProjects = projects
    .filter((project) => {
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch = (
        project.project_name.toLowerCase().includes(searchLower) ||
        project.customer_name.toLowerCase().includes(searchLower) ||
        project.job_number.toLowerCase().includes(searchLower) ||
        project.job_description.toLowerCase().includes(searchLower)
      );
      const matchesTag = !activeTagFilter || (project.tags ?? []).includes(activeTagFilter);
      return matchesSearch && matchesTag;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "name":
          return a.project_name.localeCompare(b.project_name);
        case "customer":
          return a.customer_name.localeCompare(b.customer_name);
        case "recent":
        default:
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });

  const toggleProjectSelection = (projectId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newSelected = new Set(selectedProjects);
    if (newSelected.has(projectId)) {
      newSelected.delete(projectId);
    } else {
      newSelected.add(projectId);
    }
    setSelectedProjects(newSelected);
    if (newSelected.size === 0) {
      setSelectionMode(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedProjects.size === filteredProjects.length) {
      setSelectedProjects(new Set());
      setSelectionMode(false);
    } else {
      setSelectedProjects(new Set(filteredProjects.map(p => p.id)));
    }
  };

  const cancelSelection = () => {
    setSelectedProjects(new Set());
    setSelectionMode(false);
  };

  const handleBulkEmail = async () => {
    if (!recipientEmail || selectedProjects.size === 0) {
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

      // Generate PDFs for all selected projects
      const selectedProjectsData = projects.filter(p => selectedProjects.has(p.id));
      const zip = new JSZip();

      for (const project of selectedProjectsData) {
        // Fetch media and checklists for each project
        const { data: mediaData } = await supabase
          .from('media')
          .select('*')
          .eq('report_id', project.id);

        const { data: checklistsData } = await supabase
          .from('checklists')
          .select('*')
          .eq('report_id', project.id);

        const checklistsWithItems = await Promise.all(
          (checklistsData || []).map(async (checklist) => {
            const { data: itemsData } = await supabase
              .from('checklist_items')
              .select('*')
              .eq('checklist_id', checklist.id);
            return { ...checklist, items: itemsData || [] };
          })
        );

        // Generate signed URLs for media
        const mediaUrlsMap = new Map<string, string>();
        for (const item of (mediaData || [])) {
          const { data: signedUrlData } = await supabase.storage
            .from('media')
            .createSignedUrl(item.file_path, 3600);
          if (signedUrlData?.signedUrl) {
            mediaUrlsMap.set(item.id, signedUrlData.signedUrl);
          }
        }

        const blob = await pdf(
          <ReportPDF 
            reportData={project}
            media={mediaData || []}
            checklists={checklistsWithItems}
            mediaUrls={mediaUrlsMap}
          />
        ).toBlob();

        zip.file(`${project.project_name.replace(/\s+/g, '_')}_Report.pdf`, blob);
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
          subject: `Project Reports (${selectedProjects.size} projects)`,
          message: emailMessage || undefined,
          fileData: base64Data,
          fileName: `Project_Reports_${new Date().toISOString().split('T')[0]}.zip`,
          fileSize: zipBlob.size,
        },
      });

      if (error) throw error;

      toast.success(`Email sent with ${selectedProjects.size} project reports`);
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

  const handleExportCSV = () => {
    const header = ['Project Name', 'Customer', 'Job Number', 'Created', 'Checklists', 'Tags'];
    const rows = filteredProjects.map(p => [
      `"${p.project_name.replace(/"/g, '""')}"`,
      `"${p.customer_name.replace(/"/g, '""')}"`,
      `"${p.job_number.replace(/"/g, '""')}"`,
      `"${new Date(p.created_at).toLocaleDateString()}"`,
      p.checklist_count,
      `"${(p.tags ?? []).join(', ')}"`,
    ]);
    const csv = [header.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Projects_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('CSV exported');
  };

  const handlePrint = () => {
    const rows = filteredProjects.map(p => `
      <tr>
        <td>${p.project_name}</td>
        <td>${p.customer_name}</td>
        <td>${p.job_number}</td>
        <td>${new Date(p.created_at).toLocaleDateString()}</td>
        <td>${p.checklist_count}</td>
        <td>${(p.tags ?? []).join(', ') || '—'}</td>
      </tr>
    `).join('');

    const html = `
      <html>
      <head>
        <title>Projects & Customers</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 32px; }
          h1 { font-size: 22px; margin-bottom: 4px; }
          .subtitle { color: #666; font-size: 13px; margin-bottom: 24px; }
          table { width: 100%; border-collapse: collapse; font-size: 13px; }
          th { background: #f3f4f6; text-align: left; padding: 8px 10px; border-bottom: 2px solid #e5e7eb; font-weight: 600; }
          td { padding: 8px 10px; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
          .tag { display: inline-block; background: #ede9fe; color: #5b21b6; border-radius: 9999px; padding: 1px 8px; font-size: 11px; margin: 1px; }
          @media print { body { padding: 16px; } }
        </style>
      </head>
      <body>
        <h1>Projects & Customers</h1>
        <p class="subtitle">Generated on ${new Date().toLocaleDateString()} • ${filteredProjects.length} project${filteredProjects.length !== 1 ? 's' : ''}${activeTagFilter ? ` • Filtered by tag: "${activeTagFilter}"` : ''}</p>
        <table>
          <thead>
            <tr>
              <th>Project Name</th>
              <th>Customer</th>
              <th>Job #</th>
              <th>Created</th>
              <th>Checklists</th>
              <th>Tags</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </body>
      </html>
    `;

    const win = window.open('', '_blank');
    if (win) {
      win.document.write(html);
      win.document.close();
      win.print();
    }
  };

  if (loading) {
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
          <NavbarTitle>{t('projects.title')}</NavbarTitle>
        </NavbarCenter>
        <NavbarRight>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Download className="h-4 w-4" />
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleExportCSV} className="gap-2">
                <FileText className="h-4 w-4" />
                Export CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handlePrint} className="gap-2">
                <Printer className="h-4 w-4" />
                Print / PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            onClick={() => navigate("/new-project")}
            size="sm"
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            {t('dashboard.createProject')}
          </Button>
          <SettingsButton />
        </NavbarRight>
      </GlassNavbar>

      <main className="p-4 animate-fade-in">
        {/* Bulk Actions Bar */}
        {selectionMode && selectedProjects.size > 0 && (
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
                {selectedProjects.size} selected
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleSelectAll}
                className="gap-1"
              >
                {selectedProjects.size === filteredProjects.length ? (
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
              placeholder={t('projects.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-card border-border text-foreground placeholder:text-muted-foreground"
            />
          </div>
          <div className="flex gap-2">
            {!selectionMode && projects.length > 0 && (
              <Button
                variant="outline"
                size="icon"
                onClick={() => setSelectionMode(true)}
                className="flex-shrink-0"
                title="Select projects"
              >
                <CheckSquare className="h-4 w-4" />
              </Button>
            )}
            <Select value={sortBy} onValueChange={(value: "recent" | "name" | "customer") => setSortBy(value)}>
              <SelectTrigger className="w-full sm:w-[180px] bg-card border-border text-foreground">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recent">{t('projects.sortRecent')}</SelectItem>
                <SelectItem value="name">{t('projects.sortName')}</SelectItem>
                <SelectItem value="customer">{t('projects.sortCustomer')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Tag filter chips */}
        {allTags.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-2 items-center">
            <Tag className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
            {allTags.map((tag) => (
              <button
                key={tag}
                onClick={() => setActiveTagFilter(activeTagFilter === tag ? null : tag)}
                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors ${
                  activeTagFilter === tag
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-secondary text-muted-foreground border-border hover:border-primary hover:text-primary'
                }`}
              >
                {tag}
                {activeTagFilter === tag && <X className="h-3 w-3 ml-0.5" />}
              </button>
            ))}
          </div>
        )}
        
        {/* Projects List */}
        {projects.length === 0 ? (
          <div className="rounded-lg bg-card p-8 text-center">
            <Building2 className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <p className="text-muted-foreground">{t('projects.noProjects')}</p>
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="rounded-lg bg-card p-8 text-center">
            <Search className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <p className="text-muted-foreground">{t('projects.noMatches')} "{searchQuery || activeTagFilter}"</p>
          </div>
        ) : (
            <div className="space-y-3">
              {filteredProjects.map((project) => (
                <div
                  key={project.id}
                  onClick={() => selectionMode ? toggleProjectSelection(project.id, { stopPropagation: () => {} } as React.MouseEvent) : navigate(`/project/${project.id}`)}
                  className={`flex items-start gap-4 rounded-lg bg-card p-4 hover:bg-secondary/50 transition-colors cursor-pointer ${selectedProjects.has(project.id) ? 'ring-2 ring-primary bg-primary/5' : ''}`}
                >
                  {selectionMode && (
                    <div 
                      className="flex-shrink-0 pt-1"
                      onClick={(e) => toggleProjectSelection(project.id, e)}
                    >
                      <Checkbox
                        checked={selectedProjects.has(project.id)}
                        className="h-5 w-5"
                      />
                    </div>
                  )}
                  <div className="relative flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <Building2 className="h-7 w-7 text-primary" />
                    {(project.new_comment_count ?? 0) > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-bold shadow-sm">
                        {project.new_comment_count! > 9 ? '9+' : project.new_comment_count}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-foreground text-lg mb-1">
                      {highlightText(project.project_name, searchQuery)}
                    </h3>
                    <div className="space-y-1 text-sm">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <UserIcon className="h-4 w-4 flex-shrink-0" />
                        <span className="truncate">{highlightText(project.customer_name, searchQuery)}</span>
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Hash className="h-4 w-4 flex-shrink-0" />
                        <span className="truncate">{highlightText(project.job_number, searchQuery)}</span>
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <ListChecks className="h-4 w-4 flex-shrink-0" />
                        <span>{project.checklist_count} {project.checklist_count !== 1 ? t('dashboard.checklists') : t('dashboard.checklist')}</span>
                      </div>
                      {(project.tags ?? []).length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-1">
                          {(project.tags ?? []).map((tag) => (
                            <button
                              key={tag}
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveTagFilter(activeTagFilter === tag ? null : tag);
                              }}
                              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium transition-colors ${
                                activeTagFilter === tag
                                  ? 'bg-primary text-primary-foreground border-primary'
                                  : 'bg-secondary/60 text-muted-foreground border-border hover:border-primary hover:text-primary'
                              }`}
                            >
                              {tag}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  {!selectionMode && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteProject(project.id, project.project_name);
                      }}
                      className="flex-shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-5 w-5" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
        )}

        {/* Email Dialog */}
        <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Share Projects via Email</DialogTitle>
              <DialogDescription>
                Send {selectedProjects.size} project{selectedProjects.size !== 1 ? 's' : ''} as a ZIP file attachment
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
    </div>
  );
};

export default ProjectsCustomers;
