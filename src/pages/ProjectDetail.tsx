import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { BackButton } from "@/components/BackButton";
import { SettingsButton } from "@/components/SettingsButton";
import { GlassNavbar, NavbarLeft, NavbarCenter, NavbarRight, NavbarTitle } from "@/components/GlassNavbar";
import { Building2, Hash, User as UserIcon, Image as ImageIcon, FileText, ListChecks, Calendar, Trash2, Printer, Download, Mail, Send, Loader2, Clock, Share2, Camera } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from '@/lib/dateFormat';
import { pdf } from '@react-pdf/renderer';
import { ReportPDF } from '@/components/ReportPDF';
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';
import { saveAs } from 'file-saver';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ProjectTimeline } from "@/components/ProjectTimeline";
import { ShareProjectDialog } from "@/components/ShareProjectDialog";
import { MediaLinkedContent, MediaLinkBadge } from "@/components/MediaLinkedContent";

interface ProjectData {
  id: string;
  project_name: string;
  customer_name: string;
  job_number: string;
  job_description: string;
  created_at: string;
}

interface MediaItem {
  id: string;
  file_path: string;
  file_type: string;
  created_at: string;
}

interface ChecklistData {
  id: string;
  title: string;
  created_at: string;
  items: ChecklistItem[];
}

interface ChecklistItem {
  id: string;
  text: string;
  completed: boolean;
  priority: string;
  category: string;
}

interface DocumentData {
  id: string;
  file_name: string;
  file_path: string;
  created_at: string;
  file_size: number | null;
}

const ProjectDetail = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<ProjectData | null>(null);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [mediaUrls, setMediaUrls] = useState<Record<string, string>>({});
  const [checklists, setChecklists] = useState<ChecklistData[]>([]);
  const [documents, setDocuments] = useState<DocumentData[]>([]);
  
  // Share dialog state
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  
  // Media linked content state
  const [selectedMediaForLink, setSelectedMediaForLink] = useState<string | null>(null);
  const [mediaLinkCounts, setMediaLinkCounts] = useState<Record<string, number>>({});
  
  // Email sharing state
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [emailMessage, setEmailMessage] = useState("");
  const [sendingEmail, setSendingEmail] = useState(false);

  useEffect(() => {
    if (projectId) {
      fetchProjectData();
    }
  }, [projectId]);

  const fetchProjectData = async () => {
    try {
      setLoading(true);

      // Fetch project details
      const { data: projectData, error: projectError } = await supabase
        .from('reports')
        .select('*')
        .eq('id', projectId)
        .single();

      if (projectError) throw projectError;
      setProject(projectData);

      // Fetch media
      const { data: mediaData, error: mediaError } = await supabase
        .from('media')
        .select('*')
        .eq('report_id', projectId)
        .order('created_at', { ascending: false });

      if (!mediaError && mediaData) {
        setMedia(mediaData);
        
        // Generate signed URLs for private bucket
        const urls: Record<string, string> = {};
        for (const item of mediaData) {
          const { data: signedUrlData } = await supabase.storage
            .from('media')
            .createSignedUrl(item.file_path, 3600); // 1 hour expiry
          if (signedUrlData?.signedUrl) {
            urls[item.id] = signedUrlData.signedUrl;
          }
        }
        setMediaUrls(urls);
      }

      // Fetch checklists with items
      const { data: checklistsData, error: checklistsError } = await supabase
        .from('checklists')
        .select('*')
        .eq('report_id', projectId)
        .order('created_at', { ascending: false });

      if (!checklistsError && checklistsData) {
        // Fetch items for each checklist
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

      // Fetch documents
      const { data: documentsData, error: documentsError } = await supabase
        .from('documents')
        .select('*')
        .eq('report_id', projectId)
        .order('created_at', { ascending: false });

      if (!documentsError && documentsData) {
        setDocuments(documentsData);
      }

      // Fetch linked content counts for each media item
      if (mediaData && mediaData.length > 0) {
        const mediaIds = mediaData.map((m: MediaItem) => m.id);
        
        const [notesResult, checklistResult, tasksResult] = await Promise.all([
          supabase.from('notes').select('media_id').in('media_id', mediaIds),
          supabase.from('checklist_items').select('media_id').in('media_id', mediaIds),
          supabase.from('tasks').select('media_id').in('media_id', mediaIds),
        ]);

        const counts: Record<string, number> = {};
        mediaIds.forEach((id: string) => { counts[id] = 0; });
        
        notesResult.data?.forEach((n: { media_id: string | null }) => { 
          if (n.media_id) counts[n.media_id] = (counts[n.media_id] || 0) + 1; 
        });
        checklistResult.data?.forEach((c: { media_id: string | null }) => { 
          if (c.media_id) counts[c.media_id] = (counts[c.media_id] || 0) + 1; 
        });
        tasksResult.data?.forEach((t: { media_id: string | null }) => { 
          if (t.media_id) counts[t.media_id] = (counts[t.media_id] || 0) + 1; 
        });
        
        setMediaLinkCounts(counts);
      }

    } catch (error) {
      console.error('Error fetching project data:', error);
      toast.error('Failed to load project details');
      navigate('/projects');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteMedia = async (mediaId: string) => {
    try {
      const { error } = await supabase
        .from('media')
        .delete()
        .eq('id', mediaId);

      if (error) throw error;
      
      toast.success('Media deleted');
      fetchProjectData();
    } catch (error) {
      console.error('Error deleting media:', error);
      toast.error('Failed to delete media');
    }
  };

  const handleDeleteChecklist = async (checklistId: string) => {
    try {
      const { error } = await supabase
        .from('checklists')
        .delete()
        .eq('id', checklistId);

      if (error) throw error;
      
      toast.success('Checklist deleted');
      fetchProjectData();
    } catch (error) {
      console.error('Error deleting checklist:', error);
      toast.error('Failed to delete checklist');
    }
  };

  const formatDateDisplay = (dateString: string) => {
    return formatDate(dateString);
  };

  const getMediaUrl = (mediaId: string) => {
    return mediaUrls[mediaId] || '';
  };

  const getReportTypeLabel = (reportType?: string) => {
    switch (reportType) {
      case 'field': return 'Field Report';
      case 'daily': return 'Daily Report';
      case 'weekly': return 'Weekly Report';
      case 'monthly': return 'Monthly Report';
      case 'site_survey': return 'Site Survey';
      default: return 'Field Report';
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = async () => {
    if (!project) return;
    
    try {
      const mediaUrlsMap = new Map<string, string>();
      media.forEach(item => {
        const url = mediaUrls[item.id];
        if (url) mediaUrlsMap.set(item.id, url);
      });

      const blob = await pdf(
        <ReportPDF 
          reportData={{
            ...project,
            report_type: (project as any).report_type
          }}
          media={media}
          checklists={checklists}
          mediaUrls={mediaUrlsMap}
        />
      ).toBlob();
      
      saveAs(blob, `${project.project_name.replace(/\s+/g, '_')}_Report.pdf`);
      toast.success('PDF downloaded');
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('Failed to generate PDF');
    }
  };

  const handleDownloadWord = async () => {
    if (!project) return;

    try {
      const children: Paragraph[] = [];
      
      // Title
      children.push(
        new Paragraph({
          children: [new TextRun({ text: project.project_name, bold: true, size: 48 })],
          heading: HeadingLevel.HEADING_1,
        })
      );

      // Subtitle
      children.push(
        new Paragraph({
          children: [
            new TextRun({ 
              text: `${getReportTypeLabel((project as any).report_type)} • Job #${project.job_number}`, 
              color: '666666' 
            })
          ],
        })
      );

      // Date
      children.push(
        new Paragraph({
          children: [new TextRun({ text: `Created: ${formatDateDisplay(project.created_at)}`, color: '999999', size: 20 })],
          spacing: { after: 400 },
        })
      );

      // Description
      if (project.job_description) {
        children.push(
          new Paragraph({
            children: [new TextRun({ text: 'Description', bold: true, size: 28 })],
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 400 },
          })
        );
        children.push(
          new Paragraph({
            children: [new TextRun({ text: project.job_description })],
            spacing: { after: 200 },
          })
        );
      }

      // Checklists
      if (checklists.length > 0) {
        children.push(
          new Paragraph({
            children: [new TextRun({ text: 'Checklists', bold: true, size: 28 })],
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 400 },
          })
        );
        
        checklists.forEach(checklist => {
          children.push(
            new Paragraph({
              children: [new TextRun({ text: checklist.title, bold: true })],
              spacing: { before: 200 },
            })
          );
          checklist.items.forEach(item => {
            children.push(
              new Paragraph({
                children: [
                  new TextRun({ text: item.completed ? '☑ ' : '☐ ' }),
                  new TextRun({ text: item.text }),
                  new TextRun({ text: ` (${item.priority})`, color: '666666', size: 18 }),
                ],
                spacing: { before: 100 },
              })
            );
          });
        });
      }

      const doc = new Document({
        sections: [{ children }],
      });

      const blob = await Packer.toBlob(doc);
      saveAs(blob, `${project.project_name.replace(/\s+/g, '_')}_Report.docx`);
      toast.success('Word document downloaded');
    } catch (error) {
      console.error('Error generating Word document:', error);
      toast.error('Failed to generate Word document');
    }
  };

  const handleSendEmail = async () => {
    if (!project || !recipientEmail) {
      toast.error('Please enter a recipient email');
      return;
    }

    setSendingEmail(true);
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Get user profile for sender name
      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name, first_name, last_name, company_name')
        .eq('id', user.id)
        .single();

      const senderName = profile?.display_name || 
        `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim() || 
        'Field Report User';

      // Generate PDF
      const mediaUrlsMap = new Map<string, string>();
      media.forEach(item => {
        const url = mediaUrls[item.id];
        if (url) mediaUrlsMap.set(item.id, url);
      });

      const blob = await pdf(
        <ReportPDF 
          reportData={{
            ...project,
            report_type: (project as any).report_type
          }}
          media={media}
          checklists={checklists}
          mediaUrls={mediaUrlsMap}
        />
      ).toBlob();

      // Convert blob to base64
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onloadend = () => {
          const base64 = (reader.result as string).split(',')[1];
          resolve(base64);
        };
      });
      reader.readAsDataURL(blob);
      const base64Data = await base64Promise;

      // Send email via edge function
      const { data, error } = await supabase.functions.invoke('send-export-email', {
        body: {
          recipientEmail,
          recipientName: recipientName || undefined,
          senderName,
          subject: `Project Details: ${project.project_name}`,
          message: emailMessage || undefined,
          fileData: base64Data,
          fileName: `${project.project_name.replace(/\s+/g, '_')}_Report.pdf`,
          fileSize: blob.size,
        },
      });

      if (error) throw error;

      toast.success('Email sent successfully');
      setEmailDialogOpen(false);
      setRecipientEmail("");
      setRecipientName("");
      setEmailMessage("");
    } catch (error) {
      console.error('Error sending email:', error);
      toast.error('Failed to send email');
    } finally {
      setSendingEmail(false);
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

  if (!project) {
    return (
      <div className="dark min-h-screen bg-background">
        <div className="flex min-h-screen items-center justify-center">
          <p className="text-muted-foreground">Project not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dark min-h-screen bg-background">
      {/* Glass Navbar */}
      <GlassNavbar fixed={false}>
        <NavbarLeft>
          <BackButton fallbackPath="/projects" />
        </NavbarLeft>
        <NavbarCenter>
          <NavbarTitle>Project Details</NavbarTitle>
        </NavbarCenter>
        <NavbarRight>
          <SettingsButton />
        </NavbarRight>
      </GlassNavbar>

      <main className="p-4 pb-20 animate-fade-in">
        {/* Project Info Card */}
        <Card className="mb-6 bg-card border-border">
          <CardHeader>
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <Building2 className="h-7 w-7 text-primary" />
              </div>
              <div className="flex-1">
                <CardTitle className="text-foreground">{project.project_name}</CardTitle>
                <CardDescription className="mt-2 space-y-2">
                  <div className="flex items-center gap-2">
                    <UserIcon className="h-4 w-4" />
                    <span>{project.customer_name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Hash className="h-4 w-4" />
                    <span>{project.job_number}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    <span>Created {formatDateDisplay(project.created_at)}</span>
                  </div>
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          {project.job_description && (
            <CardContent>
              <h4 className="text-sm font-semibold text-foreground mb-2">Description</h4>
              <p className="text-sm text-muted-foreground">{project.job_description}</p>
            </CardContent>
          )}
        </Card>

        {/* Continue Working Button */}
        <Button
          onClick={() => navigate("/capture-screen", { state: { reportId: projectId, projectName: project.project_name, customerName: project.customer_name, jobNumber: project.job_number } })}
          className="w-full h-14 mb-4 gap-3 bg-primary text-primary-foreground hover:bg-primary/90 text-base font-semibold"
        >
          <Camera className="h-5 w-5" />
          Continue Working on Project
        </Button>

        {/* Action Buttons */}
        <div className="flex gap-3 mb-6">
          <Button 
            variant="outline" 
            className="flex-1 gap-2"
            onClick={handlePrint}
          >
            <Printer className="h-4 w-4" />
            {t("common.print")}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="flex-1 gap-2">
                <Download className="h-4 w-4" />
                {t("common.download")}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center">
              <DropdownMenuItem onClick={handleDownloadPDF}>
                <FileText className="h-4 w-4 mr-2" />
                {t("common.saveAsPDF")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleDownloadWord}>
                <FileText className="h-4 w-4 mr-2" />
                {t("common.saveAsWord")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button 
            variant="outline" 
            className="flex-1 gap-2"
            onClick={() => setShareDialogOpen(true)}
          >
            <Share2 className="h-4 w-4" />
            {t("common.share")}
          </Button>
          <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="flex-1 gap-2">
                <Mail className="h-4 w-4" />
                Email
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Share via Email</DialogTitle>
                <DialogDescription>
                  Send project details as a PDF attachment
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="recipientEmail">Recipient Email *</Label>
                  <Input
                    id="recipientEmail"
                    type="email"
                    placeholder="email@example.com"
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="recipientName">Recipient Name (optional)</Label>
                  <Input
                    id="recipientName"
                    type="text"
                    placeholder="John Doe"
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="emailMessage">Message (optional)</Label>
                  <Textarea
                    id="emailMessage"
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
                  onClick={handleSendEmail} 
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
        </div>

        {/* Content Tabs */}
        <Tabs defaultValue="media" className="w-full">
          <TabsList className="grid w-full grid-cols-4 bg-muted">
            <TabsTrigger value="media" className="gap-2">
              <ImageIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Photos</span>
              <span className="sm:hidden">{media.length}</span>
            </TabsTrigger>
            <TabsTrigger value="timeline" className="gap-2">
              <Clock className="h-4 w-4" />
              <span className="hidden sm:inline">Timeline</span>
            </TabsTrigger>
            <TabsTrigger value="checklists" className="gap-2">
              <ListChecks className="h-4 w-4" />
              <span className="hidden sm:inline">Checklists</span>
              <span className="sm:hidden">{checklists.length}</span>
            </TabsTrigger>
            <TabsTrigger value="documents" className="gap-2">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Docs</span>
              <span className="sm:hidden">{documents.length}</span>
            </TabsTrigger>
          </TabsList>

          {/* Photos/Videos Tab */}
          <TabsContent value="media" className="mt-4">
            {media.length === 0 ? (
              <Card className="bg-card border-border">
                <CardContent className="flex flex-col items-center justify-center p-8">
                  <ImageIcon className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No photos or videos yet</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
                {media.map((item) => (
                  <div key={item.id} className="relative group">
                    <div 
                      className="aspect-square overflow-hidden rounded-lg bg-secondary cursor-pointer"
                      onClick={() => setSelectedMediaForLink(item.id)}
                    >
                      {item.file_type === 'image' ? (
                        <img
                          src={getMediaUrl(item.id)}
                          alt="Project media"
                          className="h-full w-full object-cover"
                          onError={(e) => {
                            console.error('Image load error for:', item.file_path);
                          }}
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <FileText className="h-12 w-12 text-muted-foreground" />
                        </div>
                      )}
                      {/* Linked content badge */}
                      <MediaLinkBadge 
                        count={mediaLinkCounts[item.id] || 0} 
                        onClick={() => setSelectedMediaForLink(item.id)} 
                      />
                    </div>
                    <Button
                      variant="destructive"
                      size="icon"
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => handleDeleteMedia(item.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    <p className="mt-1 text-xs text-muted-foreground">{formatDateDisplay(item.created_at)}</p>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Timeline Tab */}
          <TabsContent value="timeline" className="mt-4">
            <ProjectTimeline
              projectId={projectId!}
              projectName={project.project_name}
              customerName={project.customer_name}
            />
          </TabsContent>

          {/* Checklists Tab */}
          <TabsContent value="checklists" className="mt-4 space-y-4">
            {checklists.length === 0 ? (
              <Card className="bg-card border-border">
                <CardContent className="flex flex-col items-center justify-center p-8">
                  <ListChecks className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No checklists yet</p>
                </CardContent>
              </Card>
            ) : (
              checklists.map((checklist) => (
                <Card key={checklist.id} className="bg-card border-border">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-foreground">{checklist.title}</CardTitle>
                        <CardDescription>{formatDateDisplay(checklist.created_at)}</CardDescription>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteChecklist(checklist.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {checklist.items.map((item) => (
                        <div key={item.id} className="flex items-start gap-3 p-2 rounded bg-secondary/50">
                          <div className={`mt-0.5 h-4 w-4 rounded border-2 flex-shrink-0 ${
                            item.completed ? 'bg-primary border-primary' : 'border-muted-foreground'
                          }`}>
                            {item.completed && (
                              <svg className="h-full w-full text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>
                          <div className="flex-1">
                            <p className={`text-sm ${item.completed ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                              {item.text}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
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
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          {/* Documents Tab */}
          <TabsContent value="documents" className="mt-4">
            {documents.length === 0 ? (
              <Card className="bg-card border-border">
                <CardContent className="flex flex-col items-center justify-center p-8">
                  <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No documents yet</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {documents.map((doc) => (
                  <Card key={doc.id} className="bg-card border-border">
                    <CardContent className="flex items-center justify-between p-4">
                      <div className="flex items-center gap-3">
                        <FileText className="h-8 w-8 text-primary" />
                        <div>
                          <p className="font-medium text-foreground">{doc.file_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatDateDisplay(doc.created_at)}
                            {doc.file_size && ` • ${(doc.file_size / 1024).toFixed(1)} KB`}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Share Project Dialog */}
        {project && projectId && (
          <ShareProjectDialog
            open={shareDialogOpen}
            onOpenChange={setShareDialogOpen}
            reportId={projectId}
            projectName={project.project_name}
          />
        )}

        {/* Media Linked Content Panel */}
        {selectedMediaForLink && projectId && (
          <MediaLinkedContent
            mediaId={selectedMediaForLink}
            reportId={projectId}
            open={!!selectedMediaForLink}
            onClose={() => {
              setSelectedMediaForLink(null);
              fetchProjectData(); // Refresh to update badge counts
            }}
          />
        )}
      </main>
    </div>
  );
};

export default ProjectDetail;
