import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, CheckSquare, ListTodo, Plus, Trash2, Loader2, Link2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface LinkedNote {
  id: string;
  note_text: string;
  created_at: string;
}

interface LinkedChecklistItem {
  id: string;
  text: string;
  completed: boolean;
  priority: string;
  category: string;
}

interface LinkedTask {
  id: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
}

interface MediaLinkedContentProps {
  mediaId: string;
  reportId?: string;
  onClose: () => void;
  open: boolean;
}

export const MediaLinkedContent = ({ mediaId, reportId, onClose, open }: MediaLinkedContentProps) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState("notes");
  const [isLoading, setIsLoading] = useState(true);
  const [notes, setNotes] = useState<LinkedNote[]>([]);
  const [checklistItems, setChecklistItems] = useState<LinkedChecklistItem[]>([]);
  const [tasks, setTasks] = useState<LinkedTask[]>([]);
  
  // Add new content state
  const [isAdding, setIsAdding] = useState(false);
  const [newNoteText, setNewNoteText] = useState("");
  const [newChecklistText, setNewChecklistText] = useState("");
  const [newChecklistPriority, setNewChecklistPriority] = useState("medium");
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDescription, setNewTaskDescription] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState("medium");

  useEffect(() => {
    if (open && mediaId) {
      fetchLinkedContent();
    }
  }, [open, mediaId]);

  const fetchLinkedContent = async () => {
    setIsLoading(true);
    try {
      const [notesResult, checklistResult, tasksResult] = await Promise.all([
        supabase
          .from("notes")
          .select("id, note_text, created_at")
          .eq("media_id", mediaId),
        supabase
          .from("checklist_items")
          .select("id, text, completed, priority, category")
          .eq("media_id", mediaId),
        supabase
          .from("tasks")
          .select("id, title, description, status, priority")
          .eq("media_id", mediaId),
      ]);

      if (notesResult.data) setNotes(notesResult.data);
      if (checklistResult.data) setChecklistItems(checklistResult.data);
      if (tasksResult.data) setTasks(tasksResult.data);
    } catch (error) {
      console.error("Error fetching linked content:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const addNote = async () => {
    if (!newNoteText.trim()) return;
    setIsAdding(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("notes")
        .insert({
          user_id: user.id,
          note_text: newNoteText,
          media_id: mediaId,
          report_id: reportId || null,
        })
        .select("id, note_text, created_at")
        .single();

      if (error) throw error;
      setNotes(prev => [data, ...prev]);
      setNewNoteText("");
      toast.success(t("mediaLink.noteAdded"));
    } catch (error) {
      console.error("Error adding note:", error);
      toast.error(t("mediaLink.addError"));
    } finally {
      setIsAdding(false);
    }
  };

  const addChecklistItem = async () => {
    if (!newChecklistText.trim()) return;
    setIsAdding(true);
    try {
      // We need a checklist to add items to - for now, create linked checklist items directly
      // This requires we have a checklist_id, so we'll skip this for now unless we have a report
      if (!reportId) {
        toast.error(t("mediaLink.needsProject"));
        setIsAdding(false);
        return;
      }

      // Check if a checklist exists for this report, or create one
      let checklistId: string;
      const { data: existingChecklist } = await supabase
        .from("checklists")
        .select("id")
        .eq("report_id", reportId)
        .limit(1)
        .single();

      if (existingChecklist) {
        checklistId = existingChecklist.id;
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Not authenticated");

        const { data: newChecklist, error: checklistError } = await supabase
          .from("checklists")
          .insert({
            user_id: user.id,
            report_id: reportId,
            title: "Photo-linked items",
          })
          .select("id")
          .single();

        if (checklistError) throw checklistError;
        checklistId = newChecklist.id;
      }

      const { data, error } = await supabase
        .from("checklist_items")
        .insert({
          checklist_id: checklistId,
          text: newChecklistText,
          priority: newChecklistPriority,
          category: "general",
          media_id: mediaId,
        })
        .select("id, text, completed, priority, category")
        .single();

      if (error) throw error;
      setChecklistItems(prev => [data, ...prev]);
      setNewChecklistText("");
      toast.success(t("mediaLink.checklistAdded"));
    } catch (error) {
      console.error("Error adding checklist item:", error);
      toast.error(t("mediaLink.addError"));
    } finally {
      setIsAdding(false);
    }
  };

  const addTask = async () => {
    if (!newTaskTitle.trim()) return;
    setIsAdding(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("tasks")
        .insert({
          user_id: user.id,
          title: newTaskTitle,
          description: newTaskDescription || null,
          priority: newTaskPriority,
          status: "pending",
          media_id: mediaId,
          report_id: reportId || null,
        })
        .select("id, title, description, status, priority")
        .single();

      if (error) throw error;
      setTasks(prev => [data, ...prev]);
      setNewTaskTitle("");
      setNewTaskDescription("");
      toast.success(t("mediaLink.taskAdded"));
    } catch (error) {
      console.error("Error adding task:", error);
      toast.error(t("mediaLink.addError"));
    } finally {
      setIsAdding(false);
    }
  };

  const removeNote = async (noteId: string) => {
    try {
      await supabase.from("notes").update({ media_id: null }).eq("id", noteId);
      setNotes(prev => prev.filter(n => n.id !== noteId));
      toast.success(t("mediaLink.unlinked"));
    } catch (error) {
      console.error("Error unlinking note:", error);
    }
  };

  const removeChecklistItem = async (itemId: string) => {
    try {
      await supabase.from("checklist_items").update({ media_id: null }).eq("id", itemId);
      setChecklistItems(prev => prev.filter(i => i.id !== itemId));
      toast.success(t("mediaLink.unlinked"));
    } catch (error) {
      console.error("Error unlinking checklist item:", error);
    }
  };

  const removeTask = async (taskId: string) => {
    try {
      await supabase.from("tasks").update({ media_id: null }).eq("id", taskId);
      setTasks(prev => prev.filter(t => t.id !== taskId));
      toast.success(t("mediaLink.unlinked"));
    } catch (error) {
      console.error("Error unlinking task:", error);
    }
  };

  const totalLinked = notes.length + checklistItems.length + tasks.length;

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high": return "destructive";
      case "medium": return "default";
      case "low": return "secondary";
      default: return "outline";
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            {t("mediaLink.linkedContent")}
          </DialogTitle>
          <DialogDescription>
            {t("mediaLink.linkedContentDesc")}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="notes" className="gap-1">
                <FileText className="h-4 w-4" />
                {t("mediaLink.notes")} ({notes.length})
              </TabsTrigger>
              <TabsTrigger value="checklist" className="gap-1">
                <CheckSquare className="h-4 w-4" />
                {t("mediaLink.checklist")} ({checklistItems.length})
              </TabsTrigger>
              <TabsTrigger value="tasks" className="gap-1">
                <ListTodo className="h-4 w-4" />
                {t("mediaLink.tasks")} ({tasks.length})
              </TabsTrigger>
            </TabsList>

            {/* Notes Tab */}
            <TabsContent value="notes" className="space-y-4 mt-4">
              <div className="flex gap-2">
                <Textarea
                  placeholder={t("mediaLink.addNotePlaceholder")}
                  value={newNoteText}
                  onChange={(e) => setNewNoteText(e.target.value)}
                  className="min-h-[60px]"
                />
                <Button onClick={addNote} disabled={isAdding || !newNoteText.trim()} size="icon">
                  {isAdding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                </Button>
              </div>

              {notes.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  {t("mediaLink.noNotes")}
                </p>
              ) : (
                <div className="space-y-2">
                  {notes.map((note) => (
                    <Card key={note.id} className="bg-secondary/50">
                      <CardContent className="p-3 flex items-start justify-between gap-2">
                        <p className="text-sm flex-1">{note.note_text}</p>
                        <Button variant="ghost" size="icon" onClick={() => removeNote(note.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Checklist Tab */}
            <TabsContent value="checklist" className="space-y-4 mt-4">
              <div className="flex gap-2">
                <Input
                  placeholder={t("mediaLink.addChecklistPlaceholder")}
                  value={newChecklistText}
                  onChange={(e) => setNewChecklistText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addChecklistItem()}
                />
                <Select value={newChecklistPriority} onValueChange={setNewChecklistPriority}>
                  <SelectTrigger className="w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">{t("tasks.priorityLow")}</SelectItem>
                    <SelectItem value="medium">{t("tasks.priorityMedium")}</SelectItem>
                    <SelectItem value="high">{t("tasks.priorityHigh")}</SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={addChecklistItem} disabled={isAdding || !newChecklistText.trim()} size="icon">
                  {isAdding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                </Button>
              </div>

              {checklistItems.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  {t("mediaLink.noChecklist")}
                </p>
              ) : (
                <div className="space-y-2">
                  {checklistItems.map((item) => (
                    <Card key={item.id} className="bg-secondary/50">
                      <CardContent className="p-3 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-1">
                          <span className={item.completed ? "line-through text-muted-foreground" : ""}>
                            {item.text}
                          </span>
                          <Badge variant={getPriorityColor(item.priority) as any} className="text-xs">
                            {item.priority}
                          </Badge>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => removeChecklistItem(item.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Tasks Tab */}
            <TabsContent value="tasks" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Input
                  placeholder={t("mediaLink.addTaskPlaceholder")}
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                />
                <div className="flex gap-2">
                  <Input
                    placeholder={t("mediaLink.taskDescPlaceholder")}
                    value={newTaskDescription}
                    onChange={(e) => setNewTaskDescription(e.target.value)}
                    className="flex-1"
                  />
                  <Select value={newTaskPriority} onValueChange={setNewTaskPriority}>
                    <SelectTrigger className="w-24">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">{t("tasks.priorityLow")}</SelectItem>
                      <SelectItem value="medium">{t("tasks.priorityMedium")}</SelectItem>
                      <SelectItem value="high">{t("tasks.priorityHigh")}</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button onClick={addTask} disabled={isAdding || !newTaskTitle.trim()} size="icon">
                    {isAdding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              {tasks.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  {t("mediaLink.noTasks")}
                </p>
              ) : (
                <div className="space-y-2">
                  {tasks.map((task) => (
                    <Card key={task.id} className="bg-secondary/50">
                      <CardContent className="p-3 flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <p className="font-medium">{task.title}</p>
                          {task.description && (
                            <p className="text-sm text-muted-foreground">{task.description}</p>
                          )}
                          <div className="flex gap-2 mt-1">
                            <Badge variant={getPriorityColor(task.priority) as any} className="text-xs">
                              {task.priority}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {task.status}
                            </Badge>
                          </div>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => removeTask(task.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
};

// Badge component to show on photos
export const MediaLinkBadge = ({ 
  count, 
  onClick 
}: { 
  count: number; 
  onClick: () => void;
}) => {
  if (count === 0) return null;

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="absolute bottom-1 right-1 flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground shadow-lg"
    >
      <Link2 className="h-3 w-3" />
      {count}
    </button>
  );
};
