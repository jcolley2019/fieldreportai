import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { BackButton } from "@/components/BackButton";
import { SettingsButton } from "@/components/SettingsButton";
import { Textarea } from "@/components/ui/textarea";
import { GlassNavbar, NavbarLeft, NavbarCenter, NavbarRight, NavbarTitle } from "@/components/GlassNavbar";
import { Edit2, Trash2, Sparkles, Save, X, Search, Filter } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

interface Note {
  id: string;
  note_text: string;
  organized_notes: string | null;
  created_at: string;
  report_id: string | null;
  project_name?: string;
}

const SavedNotes = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [notes, setNotes] = useState<Note[]>([]);
  const [filteredNotes, setFilteredNotes] = useState<Note[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [editedText, setEditedText] = useState("");
  const [isOrganizing, setIsOrganizing] = useState(false);
  const [deleteNoteId, setDeleteNoteId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedProject, setSelectedProject] = useState<string>("all");
  const [aiOrganizedFilter, setAiOrganizedFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const [uniqueProjects, setUniqueProjects] = useState<string[]>([]);

  useEffect(() => {
    fetchNotes();
  }, []);

  useEffect(() => {
    filterNotes();
  }, [searchQuery, notes, selectedProject, aiOrganizedFilter, dateFrom, dateTo]);

  useEffect(() => {
    // Extract unique project names from notes
    const projects = Array.from(new Set(notes.map(note => note.project_name).filter(Boolean))) as string[];
    setUniqueProjects(projects);
  }, [notes]);

  const fetchNotes = async () => {
    try {
      setIsLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      const { data: notesData, error } = await supabase
        .from('notes')
        .select('*, reports(project_name)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error("Error fetching notes:", error);
        toast.error(t('savedNotes.loadFailed'));
        return;
      }

      const formattedNotes = notesData?.map(note => ({
        ...note,
        project_name: (note.reports as any)?.project_name || null
      })) || [];

      setNotes(formattedNotes);
    } catch (error) {
      console.error("Error fetching notes:", error);
      toast.error(t('savedNotes.loadFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  const filterNotes = () => {
    let filtered = [...notes];

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(note => 
        note.note_text.toLowerCase().includes(query) ||
        note.organized_notes?.toLowerCase().includes(query) ||
        note.project_name?.toLowerCase().includes(query)
      );
    }

    // Project filter
    if (selectedProject !== "all") {
      if (selectedProject === "standalone") {
        filtered = filtered.filter(note => !note.project_name);
      } else {
        filtered = filtered.filter(note => note.project_name === selectedProject);
      }
    }

    // AI-organized filter
    if (aiOrganizedFilter !== "all") {
      if (aiOrganizedFilter === "organized") {
        filtered = filtered.filter(note => note.organized_notes);
      } else {
        filtered = filtered.filter(note => !note.organized_notes);
      }
    }

    // Date range filter
    if (dateFrom) {
      filtered = filtered.filter(note => new Date(note.created_at) >= dateFrom);
    }
    if (dateTo) {
      const endOfDay = new Date(dateTo);
      endOfDay.setHours(23, 59, 59, 999);
      filtered = filtered.filter(note => new Date(note.created_at) <= endOfDay);
    }

    setFilteredNotes(filtered);
  };

  const handleEdit = (note: Note) => {
    setEditingNote(note);
    setEditedText(note.organized_notes || note.note_text);
  };

  const handleSaveEdit = async () => {
    if (!editingNote) return;

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('notes')
        .update({ 
          note_text: editedText,
          organized_notes: editedText 
        })
        .eq('id', editingNote.id);

      if (error) throw error;

      toast.success(t('savedNotes.noteUpdated'));
      setEditingNote(null);
      fetchNotes();
    } catch (error) {
      console.error("Error updating note:", error);
      toast.error(t('savedNotes.updateFailed'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleOrganizeWithAI = async (note: Note) => {
    setIsOrganizing(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-note-summary', {
        body: { noteText: note.note_text }
      });

      if (error) {
        console.error("Error organizing note:", error);
        if (error.message?.includes('429') || error.message?.includes('rate limit')) {
          toast.error(t('savedNotes.rateLimitError'));
        } else if (error.message?.includes('402') || error.message?.includes('credits')) {
          toast.error(t('savedNotes.creditsError'));
        } else {
          toast.error(t('savedNotes.organizeFailed'));
        }
        return;
      }

      if (data?.organizedNotes) {
        const { error: updateError } = await supabase
          .from('notes')
          .update({ organized_notes: data.organizedNotes })
          .eq('id', note.id);

        if (updateError) throw updateError;

        toast.success(t('savedNotes.noteOrganized'));
        fetchNotes();
      }
    } catch (error) {
      console.error("Error organizing note:", error);
      toast.error(t('savedNotes.organizeFailed'));
    } finally {
      setIsOrganizing(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteNoteId) return;

    try {
      const { error } = await supabase
        .from('notes')
        .delete()
        .eq('id', deleteNoteId);

      if (error) throw error;

      toast.success(t('savedNotes.noteDeleted'));
      setDeleteNoteId(null);
      fetchNotes();
    } catch (error) {
      console.error("Error deleting note:", error);
      toast.error(t('savedNotes.deleteFailed'));
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  return (
    <div className="dark min-h-screen bg-background pb-8">
      {/* Glass Navbar */}
      <GlassNavbar fixed={false}>
        <NavbarLeft>
          <BackButton />
        </NavbarLeft>
        <NavbarCenter>
          <NavbarTitle>{t('savedNotes.title')}</NavbarTitle>
        </NavbarCenter>
        <NavbarRight>
          <SettingsButton />
        </NavbarRight>
      </GlassNavbar>

      <main className="p-4">
        {/* Search and Filters */}
        <div className="mb-6 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('savedNotes.searchPlaceholder')}
              className="pl-9 bg-card"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Project Filter */}
            <Select value={selectedProject} onValueChange={setSelectedProject}>
              <SelectTrigger className="bg-card">
                <SelectValue placeholder={t('savedNotes.filterByProject')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('savedNotes.allProjects')}</SelectItem>
                <SelectItem value="standalone">{t('savedNotes.standaloneNotes')}</SelectItem>
                {uniqueProjects.map(project => (
                  <SelectItem key={project} value={project}>{project}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* AI-Organized Filter */}
            <Select value={aiOrganizedFilter} onValueChange={setAiOrganizedFilter}>
              <SelectTrigger className="bg-card">
                <SelectValue placeholder={t('savedNotes.filterByAI')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('savedNotes.allNotes')}</SelectItem>
                <SelectItem value="organized">{t('savedNotes.aiOrganized')}</SelectItem>
                <SelectItem value="not-organized">{t('savedNotes.notOrganized')}</SelectItem>
              </SelectContent>
            </Select>

            {/* Date Range Filter */}
            <div className="flex gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="flex-1 bg-card justify-start text-left font-normal">
                    {dateFrom ? format(dateFrom, "MMM d, yyyy") : t('savedNotes.fromDate')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dateFrom}
                    onSelect={setDateFrom}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="flex-1 bg-card justify-start text-left font-normal">
                    {dateTo ? format(dateTo, "MMM d, yyyy") : t('savedNotes.toDate')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dateTo}
                    onSelect={setDateTo}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Clear Filters */}
          {(selectedProject !== "all" || aiOrganizedFilter !== "all" || dateFrom || dateTo) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSelectedProject("all");
                setAiOrganizedFilter("all");
                setDateFrom(undefined);
                setDateTo(undefined);
              }}
              className="w-full"
            >
              <X className="mr-2 h-4 w-4" />
              {t('savedNotes.clearFilters')}
            </Button>
          )}
        </div>

        {/* Notes List */}
        {isLoading ? (
          <div className="text-center text-muted-foreground py-8">
            {t('savedNotes.loading')}
          </div>
        ) : filteredNotes.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            {searchQuery ? t('savedNotes.noNotesFound') : t('savedNotes.noSavedNotes')}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredNotes.map((note) => (
              <div
                key={note.id}
                className="bg-card rounded-lg p-4 border border-border space-y-3"
              >
                {/* Note Header */}
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-xs text-muted-foreground">
                        {formatDate(note.created_at)}
                      </p>
                      {note.project_name && (
                        <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                          {note.project_name}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(note)}
                      title={t('savedNotes.editNote')}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    {!note.organized_notes && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleOrganizeWithAI(note)}
                        disabled={isOrganizing}
                        title={t('savedNotes.organizeWithAI')}
                      >
                        <Sparkles className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeleteNoteId(note.id)}
                      title={t('savedNotes.deleteNote')}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>

                {/* Note Content */}
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <p className="text-foreground whitespace-pre-wrap line-clamp-3">
                    {note.organized_notes || note.note_text}
                  </p>
                </div>

                {note.organized_notes && (
                  <div className="pt-2 border-t border-border">
                    <span className="text-xs text-primary flex items-center gap-1">
                      <Sparkles className="h-3 w-3" />
                      {t('savedNotes.aiOrganized')}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Edit Dialog */}
      <Dialog open={!!editingNote} onOpenChange={() => setEditingNote(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('savedNotes.editDialogTitle')}</DialogTitle>
            <DialogDescription>
              {t('savedNotes.editDialogDescription')}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <Textarea
              value={editedText}
              onChange={(e) => setEditedText(e.target.value)}
              className="min-h-[300px] resize-none bg-card"
              placeholder={t('savedNotes.enterNote')}
            />

            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => setEditingNote(null)}
              >
                <X className="mr-2 h-4 w-4" />
                {t('savedNotes.cancel')}
              </Button>
              <Button
                onClick={handleSaveEdit}
                disabled={isSaving}
              >
                <Save className="mr-2 h-4 w-4" />
                {isSaving ? t('savedNotes.saving') : t('savedNotes.saveChanges')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteNoteId} onOpenChange={() => setDeleteNoteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('savedNotes.deleteDialogTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('savedNotes.deleteDialogDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('savedNotes.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {t('savedNotes.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default SavedNotes;