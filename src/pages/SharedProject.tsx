import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { 
  Camera, 
  FileText, 
  CheckSquare, 
  ListTodo, 
  Download, 
  Clock, 
  Building2,
  Loader2,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  X
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

interface ProjectData {
  project: {
    project_name: string;
    customer_name: string;
    job_number: string;
    job_description: string;
    created_at: string;
  };
  media: Array<{
    id: string;
    file_path: string;
    file_type: string;
    captured_at: string;
    location_name?: string;
    signedUrl: string;
    thumbnailUrl: string | null;
  }>;
  notes: Array<{
    id: string;
    note_text: string;
    organized_notes?: string;
    created_at: string;
  }>;
  checklists: Array<{
    id: string;
    title: string;
    checklist_items: Array<{
      id: string;
      text: string;
      completed: boolean;
      priority: string;
      category: string;
    }>;
  }>;
  tasks: Array<{
    id: string;
    title: string;
    description?: string;
    status: string;
    priority: string;
    due_date?: string;
  }>;
  owner: {
    company_name?: string;
    company_logo_url?: string;
    first_name?: string;
    last_name?: string;
  };
  allowDownload: boolean;
  expiresAt: string;
}

export default function SharedProject() {
  const { token } = useParams<{ token: string }>();
  const { t } = useTranslation();
  const [data, setData] = useState<ProjectData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("photos");
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  useEffect(() => {
    if (token) {
      fetchSharedProject();
    }
  }, [token]);

  const fetchSharedProject = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data: result, error: fnError } = await supabase.functions.invoke("get-public-share", {
        body: { token },
      });

      if (fnError) throw fnError;
      if (result.error) throw new Error(result.error);

      setData(result);
    } catch (err: any) {
      console.error("Error fetching shared project:", err);
      setError(err.message || t("share.loadError"));
    } finally {
      setIsLoading(false);
    }
  };

  const downloadImage = async (url: string, filename: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error("Download failed:", err);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high": return "destructive";
      case "medium": return "default";
      case "low": return "secondary";
      default: return "outline";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed": return "default";
      case "in_progress": return "secondary";
      case "pending": return "outline";
      default: return "outline";
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">{t("common.loading")}</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="max-w-md mx-auto">
          <CardContent className="pt-6 text-center space-y-4">
            <AlertTriangle className="h-12 w-12 mx-auto text-destructive" />
            <h2 className="text-xl font-semibold">{t("share.unavailable")}</h2>
            <p className="text-muted-foreground">{error || t("share.linkInvalid")}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { project, media, notes, checklists, tasks, owner, allowDownload, expiresAt } = data;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container max-w-6xl mx-auto px-4 py-6">
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              {owner?.company_logo_url && (
                <img 
                  src={owner.company_logo_url} 
                  alt={owner.company_name || "Company"} 
                  className="h-10 object-contain mb-2"
                />
              )}
              <h1 className="text-2xl font-bold">{project.project_name}</h1>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Building2 className="h-4 w-4" />
                  {project.customer_name}
                </span>
                <span>#{project.job_number}</span>
              </div>
            </div>
            <div className="text-right text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                {t("share.expiresOn", { date: format(new Date(expiresAt), "MMM d, yyyy") })}
              </div>
              {owner?.company_name && (
                <p className="mt-1">{t("share.sharedBy", { name: owner.company_name })}</p>
              )}
            </div>
          </div>
          {project.job_description && (
            <p className="mt-4 text-muted-foreground">{project.job_description}</p>
          )}
        </div>
      </header>

      {/* Content */}
      <main className="container max-w-6xl mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="photos" className="gap-2">
              <Camera className="h-4 w-4" />
              {t("share.photos")} ({media.length})
            </TabsTrigger>
            <TabsTrigger value="notes" className="gap-2">
              <FileText className="h-4 w-4" />
              {t("share.notes")} ({notes.length})
            </TabsTrigger>
            <TabsTrigger value="checklists" className="gap-2">
              <CheckSquare className="h-4 w-4" />
              {t("share.checklists")} ({checklists.length})
            </TabsTrigger>
            <TabsTrigger value="tasks" className="gap-2">
              <ListTodo className="h-4 w-4" />
              {t("share.tasks")} ({tasks.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="photos">
            {media.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  {t("share.noPhotos")}
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {media.map((item, index) => (
                  <div
                    key={item.id}
                    className="relative group aspect-square rounded-lg overflow-hidden bg-muted cursor-pointer"
                    onClick={() => setLightboxIndex(index)}
                  >
                    <img
                      src={item.thumbnailUrl || item.signedUrl}
                      alt=""
                      loading="lazy"
                      className="w-full h-full object-cover transition-transform group-hover:scale-105"
                      onError={(e) => {
                        // Fall back to full-size if thumbnail fails
                        if ((e.target as HTMLImageElement).src !== item.signedUrl) {
                          (e.target as HTMLImageElement).src = item.signedUrl;
                        }
                      }}
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors" />
                    <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/60 to-transparent">
                      <p className="text-white text-xs">
                        {format(new Date(item.captured_at), "MMM d, yyyy h:mm a")}
                      </p>
                      {item.location_name && (
                        <p className="text-white/80 text-xs truncate">{item.location_name}</p>
                      )}
                    </div>
                    {allowDownload && (
                      <Button
                        variant="secondary"
                        size="icon"
                        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => {
                          e.stopPropagation();
                          downloadImage(item.signedUrl, `photo-${item.id}.jpg`);
                        }}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="notes">
            {notes.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  {t("share.noNotes")}
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {notes.map((note) => (
                  <Card key={note.id}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm text-muted-foreground">
                        {format(new Date(note.created_at), "MMM d, yyyy h:mm a")}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {note.organized_notes ? (
                        <div className="prose prose-sm dark:prose-invert max-w-none" 
                             dangerouslySetInnerHTML={{ __html: note.organized_notes }} />
                      ) : (
                        <p className="whitespace-pre-wrap">{note.note_text}</p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="checklists">
            {checklists.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  {t("share.noChecklists")}
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {checklists.map((checklist) => (
                  <Card key={checklist.id}>
                    <CardHeader>
                      <CardTitle>{checklist.title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {checklist.checklist_items.map((item) => (
                          <div
                            key={item.id}
                            className={`flex items-center gap-3 p-2 rounded ${
                              item.completed ? "bg-muted" : ""
                            }`}
                          >
                            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                              item.completed ? "bg-primary border-primary text-primary-foreground" : "border-muted-foreground"
                            }`}>
                              {item.completed && "✓"}
                            </div>
                            <span className={item.completed ? "line-through text-muted-foreground" : ""}>
                              {item.text}
                            </span>
                            <Badge variant={getPriorityColor(item.priority) as any} className="ml-auto">
                              {item.priority}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="tasks">
            {tasks.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  {t("share.noTasks")}
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {tasks.map((task) => (
                  <Card key={task.id}>
                    <CardContent className="py-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-1">
                          <h3 className="font-medium">{task.title}</h3>
                          {task.description && (
                            <p className="text-sm text-muted-foreground">{task.description}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={getPriorityColor(task.priority) as any}>
                            {task.priority}
                          </Badge>
                          <Badge variant={getStatusColor(task.status) as any}>
                            {task.status.replace("_", " ")}
                          </Badge>
                        </div>
                      </div>
                      {task.due_date && (
                        <p className="text-xs text-muted-foreground mt-2">
                          Due: {format(new Date(task.due_date), "MMM d, yyyy")}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>

      {/* Lightbox */}
      {lightboxIndex !== null && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center">
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-4 right-4 text-white hover:bg-white/20"
            onClick={() => setLightboxIndex(null)}
          >
            <X className="h-6 w-6" />
          </Button>
          
          {lightboxIndex > 0 && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute left-4 text-white hover:bg-white/20"
              onClick={() => setLightboxIndex(lightboxIndex - 1)}
            >
              <ChevronLeft className="h-8 w-8" />
            </Button>
          )}
          
          {lightboxIndex < media.length - 1 && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-4 text-white hover:bg-white/20"
              onClick={() => setLightboxIndex(lightboxIndex + 1)}
            >
              <ChevronRight className="h-8 w-8" />
            </Button>
          )}

          <img
            src={media[lightboxIndex].signedUrl}
            alt=""
            className="max-h-[90vh] max-w-[90vw] object-contain"
          />

          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white text-center">
            <p>{format(new Date(media[lightboxIndex].captured_at), "MMMM d, yyyy h:mm a")}</p>
            {media[lightboxIndex].location_name && (
              <p className="text-white/70">{media[lightboxIndex].location_name}</p>
            )}
            <p className="text-white/50 text-sm mt-1">
              {lightboxIndex + 1} / {media.length}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
