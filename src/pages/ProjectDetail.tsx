import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { BackButton } from "@/components/BackButton";
import { SettingsButton } from "@/components/SettingsButton";
import { GlassNavbar, NavbarLeft, NavbarCenter, NavbarRight, NavbarTitle } from "@/components/GlassNavbar";
import { Building2, Hash, User as UserIcon, Image as ImageIcon, FileText, ListChecks, Calendar, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from '@/lib/dateFormat';

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
  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<ProjectData | null>(null);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [mediaUrls, setMediaUrls] = useState<Record<string, string>>({});
  const [checklists, setChecklists] = useState<ChecklistData[]>([]);
  const [documents, setDocuments] = useState<DocumentData[]>([]);

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

        {/* Content Tabs */}
        <Tabs defaultValue="media" className="w-full">
          <TabsList className="grid w-full grid-cols-3 bg-muted">
            <TabsTrigger value="media" className="gap-2">
              <ImageIcon className="h-4 w-4" />
              Photos ({media.length})
            </TabsTrigger>
            <TabsTrigger value="checklists" className="gap-2">
              <ListChecks className="h-4 w-4" />
              Checklists ({checklists.length})
            </TabsTrigger>
            <TabsTrigger value="documents" className="gap-2">
              <FileText className="h-4 w-4" />
              Documents ({documents.length})
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
                    <div className="aspect-square overflow-hidden rounded-lg bg-secondary">
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
      </main>
    </div>
  );
};

export default ProjectDetail;
