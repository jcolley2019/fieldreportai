import { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import JSZip from "jszip";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  X,
  CalendarDays,
  ImageIcon,
  StickyNote,
  MessageSquare,
  Send,
  User,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { toast } from "sonner";

interface PhotoComment {
  id: string;
  media_id: string;
  commenter_name: string;
  comment_text: string;
  created_at: string;
}

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
  const [isZipping, setIsZipping] = useState(false);
  const [locationFilter, setLocationFilter] = useState<string>("all");

  // Comments state
  const [comments, setComments] = useState<PhotoComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commenterName, setCommenterName] = useState("");
  const [commentText, setCommentText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCommentPanel, setShowCommentPanel] = useState(false);
  const commentsEndRef = useRef<HTMLDivElement>(null);

  const downloadAllZip = async () => {
    if (!data) return;
    setIsZipping(true);
    try {
      const zip = new JSZip();
      const folder = zip.folder(data.project.project_name || "photos")!;
      await Promise.all(
        data.media
          .filter((m) => m.signedUrl)
          .map(async (m, idx) => {
            const res = await fetch(m.signedUrl);
            const blob = await res.blob();
            const ext = m.signedUrl.split("?")[0].split(".").pop() || "jpg";
            folder.file(`photo-${idx + 1}.${ext}`, blob);
          })
      );
      const content = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(content);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${data.project.project_name || "photos"}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("ZIP download failed:", err);
    } finally {
      setIsZipping(false);
    }
  };

  const timelineItems = data
    ? [
        ...(data.media.map((m) => ({ type: "photo" as const, date: new Date(m.captured_at), item: m }))),
        ...(data.notes.map((n) => ({ type: "note" as const, date: new Date(n.created_at), item: n }))),
      ].sort((a, b) => a.date.getTime() - b.date.getTime())
    : [];

  useEffect(() => {
    if (token) fetchSharedProject();
  }, [token]);

  // Fetch all comments for this share link when data is loaded
  useEffect(() => {
    if (data && token) fetchComments();
  }, [data, token]);

  // Auto-scroll to newest comment
  useEffect(() => {
    if (showCommentPanel) {
      commentsEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [comments, showCommentPanel]);

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

  const fetchComments = async () => {
    if (!token) return;
    setCommentsLoading(true);
    try {
      const { data: result, error } = await supabase.functions.invoke("get-photo-comments", {
        body: { share_token: token },
      });
      if (error) throw error;
      setComments(result.comments || []);
    } catch (err) {
      console.error("Failed to fetch comments:", err);
    } finally {
      setCommentsLoading(false);
    }
  };

  const handleSubmitComment = async () => {
    if (!token || lightboxIndex === null || !data) return;

    const name = commenterName.trim();
    const text = commentText.trim();

    if (!name) { toast.error("Please enter your name"); return; }
    if (!text) { toast.error("Please enter a comment"); return; }
    if (name.length > 100) { toast.error("Name must be under 100 characters"); return; }
    if (text.length > 1000) { toast.error("Comment must be under 1000 characters"); return; }

    const mediaId = data.media[lightboxIndex]?.id;
    if (!mediaId) return;

    setIsSubmitting(true);
    try {
      const { data: result, error } = await supabase.functions.invoke("post-photo-comment", {
        body: {
          share_token: token,
          media_id: mediaId,
          commenter_name: name,
          comment_text: text,
        },
      });

      if (error) throw error;
      if (result.error) throw new Error(result.error);

      // Optimistic update + refetch
      setComments((prev) => [...prev, result.comment]);
      setCommentText("");
      toast.success("Comment posted!");
    } catch (err: any) {
      toast.error(err.message || "Failed to post comment");
    } finally {
      setIsSubmitting(false);
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

  // Comments for the currently open photo
  const currentMediaId = lightboxIndex !== null && data ? data.media[lightboxIndex]?.id : null;
  const currentPhotoComments = comments.filter((c) => c.media_id === currentMediaId);

  // Comment count per media item (for badge on thumbnails)
  const commentCountByMedia = comments.reduce<Record<string, number>>((acc, c) => {
    acc[c.media_id] = (acc[c.media_id] || 0) + 1;
    return acc;
  }, {});

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
            <TabsTrigger value="timeline" className="gap-2">
              <CalendarDays className="h-4 w-4" />
              Timeline ({timelineItems.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="photos">
            {media.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  {t("share.noPhotos")}
                </CardContent>
              </Card>
            ) : (() => {
              const locations = Array.from(
                new Set(media.map((m) => m.location_name).filter(Boolean))
              ) as string[];
              const hasLocations = locations.length > 0;
              const filteredMedia = locationFilter === "all"
                ? media
                : media.filter((m) => m.location_name === locationFilter);

              return (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                    {hasLocations ? (
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => setLocationFilter("all")}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                            locationFilter === "all"
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-card text-foreground border-border hover:bg-muted"
                          }`}
                        >
                          All ({media.length})
                        </button>
                        {locations.map((loc) => {
                          const count = media.filter((m) => m.location_name === loc).length;
                          return (
                            <button
                              key={loc}
                              onClick={() => setLocationFilter(loc)}
                              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                                locationFilter === loc
                                  ? "bg-primary text-primary-foreground border-primary"
                                  : "bg-card text-foreground border-border hover:bg-muted"
                              }`}
                            >
                              {loc} ({count})
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div />
                    )}
                    {allowDownload && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2 shrink-0"
                        onClick={downloadAllZip}
                        disabled={isZipping}
                      >
                        {isZipping ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                        {isZipping ? "Preparing ZIP…" : `Download All (${media.length})`}
                      </Button>
                    )}
                  </div>

                  {filteredMedia.length === 0 ? (
                    <p className="text-center text-muted-foreground py-12">No photos at this location.</p>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      {filteredMedia.map((item) => {
                        const globalIndex = media.findIndex((m) => m.id === item.id);
                        const commentCount = commentCountByMedia[item.id] || 0;
                        return (
                          <div
                            key={item.id}
                            className="relative group aspect-square rounded-lg overflow-hidden bg-muted cursor-pointer"
                            onClick={() => {
                              setLightboxIndex(globalIndex);
                              setShowCommentPanel(false);
                            }}
                          >
                            <img
                              src={item.thumbnailUrl || item.signedUrl}
                              alt=""
                              loading="lazy"
                              className="w-full h-full object-cover transition-transform group-hover:scale-105"
                              onError={(e) => {
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
                            {/* Comment count badge */}
                            {commentCount > 0 && (
                              <div className="absolute top-2 left-2 flex items-center gap-1 bg-black/70 rounded-full px-2 py-0.5">
                                <MessageSquare className="h-3 w-3 text-white" />
                                <span className="text-white text-xs font-medium">{commentCount}</span>
                              </div>
                            )}
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
                        );
                      })}
                    </div>
                  )}
                </>
              );
            })()}
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
                            className={`flex items-center gap-3 p-2 rounded ${item.completed ? "bg-muted" : ""}`}
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
                          <Badge variant={getPriorityColor(task.priority) as any}>{task.priority}</Badge>
                          <Badge variant={getStatusColor(task.status) as any}>{task.status.replace("_", " ")}</Badge>
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

          {/* ── Timeline Tab ── */}
          <TabsContent value="timeline">
            {timelineItems.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  No activity to show yet.
                </CardContent>
              </Card>
            ) : (() => {
              const groups: { label: string; entries: typeof timelineItems }[] = [];
              timelineItems.forEach((entry) => {
                const dayLabel = format(entry.date, "EEEE, MMMM d, yyyy");
                const last = groups[groups.length - 1];
                if (last && last.label === dayLabel) {
                  last.entries.push(entry);
                } else {
                  groups.push({ label: dayLabel, entries: [entry] });
                }
              });
              return (
                <div className="space-y-8">
                  {groups.map((group) => (
                    <div key={group.label}>
                      <div className="sticky top-0 z-10 bg-background/90 backdrop-blur-sm py-2 mb-4 border-b border-border">
                        <div className="flex items-center gap-2">
                          <CalendarDays className="h-4 w-4 text-primary" />
                          <span className="text-sm font-semibold text-foreground">{group.label}</span>
                          <span className="text-xs text-muted-foreground ml-1">· {group.entries.length} item{group.entries.length !== 1 ? "s" : ""}</span>
                        </div>
                      </div>
                      <div className="relative pl-6 border-l-2 border-border space-y-6">
                        {group.entries.map((entry, idx) => (
                          <div key={idx} className="relative">
                            <div className={`absolute -left-[1.65rem] top-1 w-5 h-5 rounded-full border-2 border-background flex items-center justify-center ${
                              entry.type === "photo" ? "bg-primary" : "bg-muted-foreground"
                            }`}>
                              {entry.type === "photo"
                                ? <ImageIcon className="h-2.5 w-2.5 text-primary-foreground" />
                                : <StickyNote className="h-2.5 w-2.5 text-background" />
                              }
                            </div>
                            <p className="text-xs text-muted-foreground mb-2">{format(entry.date, "h:mm a")}</p>
                            {entry.type === "photo" ? (
                              <div
                                className="relative w-48 rounded-lg overflow-hidden cursor-pointer group"
                                onClick={() => {
                                  const photoIdx = media.findIndex(m => m.id === entry.item.id);
                                  setLightboxIndex(photoIdx);
                                  setShowCommentPanel(false);
                                }}
                              >
                                <img
                                  src={(entry.item as typeof media[0]).thumbnailUrl || (entry.item as typeof media[0]).signedUrl}
                                  alt=""
                                  loading="lazy"
                                  className="w-full aspect-square object-cover group-hover:scale-105 transition-transform"
                                  onError={(e) => {
                                    const full = (entry.item as typeof media[0]).signedUrl;
                                    if ((e.target as HTMLImageElement).src !== full) {
                                      (e.target as HTMLImageElement).src = full;
                                    }
                                  }}
                                />
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                                {(entry.item as typeof media[0]).location_name && (
                                  <p className="absolute bottom-0 left-0 right-0 px-2 py-1 text-[10px] text-white bg-black/50 truncate">
                                    {(entry.item as typeof media[0]).location_name}
                                  </p>
                                )}
                                {(commentCountByMedia[(entry.item as typeof media[0]).id] || 0) > 0 && (
                                  <div className="absolute top-1 left-1 flex items-center gap-1 bg-black/70 rounded-full px-1.5 py-0.5">
                                    <MessageSquare className="h-2.5 w-2.5 text-white" />
                                    <span className="text-white text-[10px]">{commentCountByMedia[(entry.item as typeof media[0]).id]}</span>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <Card className="max-w-xl">
                                <CardContent className="py-3 px-4">
                                  {(entry.item as typeof notes[0]).organized_notes ? (
                                    <div
                                      className="prose prose-sm dark:prose-invert max-w-none"
                                      dangerouslySetInnerHTML={{ __html: (entry.item as typeof notes[0]).organized_notes! }}
                                    />
                                  ) : (
                                    <p className="whitespace-pre-wrap text-sm">
                                      {(entry.item as typeof notes[0]).note_text}
                                    </p>
                                  )}
                                </CardContent>
                              </Card>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </TabsContent>
        </Tabs>
      </main>

      {/* ── Lightbox with Comment Panel ── */}
      {lightboxIndex !== null && (
        <div className="fixed inset-0 z-50 bg-black/95 flex">
          {/* Close button */}
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-4 right-4 z-10 text-white hover:bg-white/20"
            onClick={() => { setLightboxIndex(null); setShowCommentPanel(false); }}
          >
            <X className="h-6 w-6" />
          </Button>

          {/* Photo area */}
          <div className={`flex flex-col items-center justify-center transition-all duration-300 ${showCommentPanel ? "w-full md:w-3/5" : "w-full"}`}>
            {/* Prev / Next */}
            {lightboxIndex > 0 && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute left-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20 z-10"
                onClick={() => { setLightboxIndex(lightboxIndex - 1); }}
              >
                <ChevronLeft className="h-8 w-8" />
              </Button>
            )}
            {lightboxIndex < media.length - 1 && (
              <Button
                variant="ghost"
                size="icon"
                className={`absolute ${showCommentPanel ? "right-[calc(40%+1rem)] md:right-[calc(40%+1rem)]" : "right-4"} top-1/2 -translate-y-1/2 text-white hover:bg-white/20 z-10`}
                onClick={() => { setLightboxIndex(lightboxIndex + 1); }}
              >
                <ChevronRight className="h-8 w-8" />
              </Button>
            )}

            <img
              src={media[lightboxIndex].signedUrl}
              alt=""
              className="max-h-[80vh] max-w-full object-contain px-16"
            />

            {/* Bottom info + comment toggle */}
            <div className="absolute bottom-4 left-0 right-0 flex items-end justify-between px-4">
              <div className="text-white text-center flex-1">
                <p className="text-sm">{format(new Date(media[lightboxIndex].captured_at), "MMMM d, yyyy h:mm a")}</p>
                {media[lightboxIndex].location_name && (
                  <p className="text-white/70 text-sm">{media[lightboxIndex].location_name}</p>
                )}
                <p className="text-white/50 text-xs mt-1">{lightboxIndex + 1} / {media.length}</p>
              </div>

              {/* Comment toggle button */}
              <button
                onClick={() => setShowCommentPanel((p) => !p)}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  showCommentPanel
                    ? "bg-primary text-primary-foreground"
                    : "bg-white/20 text-white hover:bg-white/30"
                }`}
              >
                <MessageSquare className="h-4 w-4" />
                {currentPhotoComments.length > 0 ? currentPhotoComments.length : ""}
                {showCommentPanel ? "Hide" : "Comments"}
              </button>
            </div>
          </div>

          {/* Comment panel — slides in from right */}
          {showCommentPanel && (
            <div className="hidden md:flex w-2/5 flex-col bg-card border-l border-border">
              {/* Panel header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-primary" />
                  <h3 className="font-semibold text-foreground">
                    Comments
                    {currentPhotoComments.length > 0 && (
                      <span className="ml-2 text-xs text-muted-foreground">({currentPhotoComments.length})</span>
                    )}
                  </h3>
                </div>
                <button
                  className="text-muted-foreground hover:text-foreground"
                  onClick={() => setShowCommentPanel(false)}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Comments list */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {commentsLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : currentPhotoComments.length === 0 ? (
                  <div className="text-center py-8 space-y-2">
                    <MessageSquare className="h-8 w-8 mx-auto text-muted-foreground/40" />
                    <p className="text-sm text-muted-foreground">No comments yet</p>
                    <p className="text-xs text-muted-foreground/60">Be the first to leave feedback</p>
                  </div>
                ) : (
                  currentPhotoComments.map((comment) => (
                    <div key={comment.id} className="bg-muted/50 rounded-lg p-3 space-y-1">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
                          <User className="h-3 w-3 text-primary" />
                        </div>
                        <span className="text-xs font-semibold text-foreground">{comment.commenter_name}</span>
                        <span className="text-xs text-muted-foreground ml-auto">
                          {format(new Date(comment.created_at), "MMM d, h:mm a")}
                        </span>
                      </div>
                      <p className="text-sm text-foreground pl-8 whitespace-pre-wrap">{comment.comment_text}</p>
                    </div>
                  ))
                )}
                <div ref={commentsEndRef} />
              </div>

              {/* Add comment form */}
              <div className="border-t border-border p-4 space-y-3">
                <Input
                  placeholder="Your name"
                  value={commenterName}
                  onChange={(e) => setCommenterName(e.target.value.slice(0, 100))}
                  className="text-sm"
                />
                <div className="flex gap-2">
                  <Textarea
                    placeholder="Leave a comment on this photo…"
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value.slice(0, 1000))}
                    className="text-sm resize-none min-h-[72px]"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSubmitComment();
                    }}
                  />
                  <Button
                    size="icon"
                    onClick={handleSubmitComment}
                    disabled={isSubmitting || !commenterName.trim() || !commentText.trim()}
                    className="self-end shrink-0 h-9 w-9"
                  >
                    {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">{commentText.length}/1000 · Cmd+Enter to send</p>
              </div>
            </div>
          )}

          {/* Mobile comment sheet — shown below the image on small screens */}
          {showCommentPanel && (
            <div className="fixed bottom-0 left-0 right-0 md:hidden z-20 bg-card border-t border-border rounded-t-2xl max-h-[60vh] flex flex-col">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <h3 className="font-semibold text-sm text-foreground flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-primary" />
                  Comments {currentPhotoComments.length > 0 && `(${currentPhotoComments.length})`}
                </h3>
                <button onClick={() => setShowCommentPanel(false)}>
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {currentPhotoComments.length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground py-4">No comments yet — be the first!</p>
                ) : (
                  currentPhotoComments.map((comment) => (
                    <div key={comment.id} className="bg-muted/50 rounded-lg p-2.5 space-y-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold">{comment.commenter_name}</span>
                        <span className="text-[10px] text-muted-foreground ml-auto">
                          {format(new Date(comment.created_at), "MMM d, h:mm a")}
                        </span>
                      </div>
                      <p className="text-xs text-foreground whitespace-pre-wrap">{comment.comment_text}</p>
                    </div>
                  ))
                )}
                <div ref={commentsEndRef} />
              </div>
              <div className="p-3 border-t border-border space-y-2">
                <Input
                  placeholder="Your name"
                  value={commenterName}
                  onChange={(e) => setCommenterName(e.target.value.slice(0, 100))}
                  className="text-sm h-8"
                />
                <div className="flex gap-2">
                  <Input
                    placeholder="Leave a comment…"
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value.slice(0, 1000))}
                    className="text-sm h-8"
                    onKeyDown={(e) => { if (e.key === "Enter") handleSubmitComment(); }}
                  />
                  <Button
                    size="icon"
                    onClick={handleSubmitComment}
                    disabled={isSubmitting || !commenterName.trim() || !commentText.trim()}
                    className="h-8 w-8 shrink-0"
                  >
                    {isSubmitting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
