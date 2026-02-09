import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { BackButton } from "@/components/BackButton";
import { SettingsButton } from "@/components/SettingsButton";
import { GlassNavbar, NavbarLeft, NavbarCenter, NavbarRight, NavbarTitle } from "@/components/GlassNavbar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Sparkles, Trash2, Clock, Flag, CheckCircle2, Circle, Loader2, Mic, MicOff, FolderOpen, ImageIcon } from "lucide-react";
import { PhotoPickerDialog } from "@/components/PhotoPickerDialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { TaskActionsBar } from "@/components/tasks/TaskActionsBar";
import { TaskProjectSelector } from "@/components/tasks/TaskProjectSelector";

interface Task {
  id: string;
  title: string;
  description?: string;
  priority: 'low' | 'medium' | 'high';
  status: 'pending' | 'in_progress' | 'completed';
  due_date?: string;
  created_at: string;
}

const Tasks = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const isSimpleMode = location.state?.simpleMode || false;
  const initialReportId = location.state?.reportId;
  const initialProjectName = location.state?.projectName;

  const [reportId, setReportId] = useState<string | undefined>(initialReportId);
  const [projectName, setProjectName] = useState<string | undefined>(initialProjectName);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [isSuggestingTasks, setIsSuggestingTasks] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newTask, setNewTask] = useState<{ title: string; description: string; priority: 'low' | 'medium' | 'high' }>({ title: '', description: '', priority: 'medium' });
  const [filter, setFilter] = useState<'all' | 'pending' | 'in_progress' | 'completed'>('all');
  const [showProjectSelector, setShowProjectSelector] = useState(false);
  const [photoPickerTaskId, setPhotoPickerTaskId] = useState<string | null>(null);
  
  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessingVoice, setIsProcessingVoice] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);

  useEffect(() => {
    fetchTasks();
  }, [reportId]);

  const fetchTasks = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/auth');
        return;
      }

      let query = supabase
        .from('tasks')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (reportId) {
        query = query.eq('report_id', reportId);
      }

      const { data, error } = await query;

      if (error) throw error;
      setTasks((data as Task[]) || []);
    } catch (error) {
      console.error('Error fetching tasks:', error);
      toast.error(t('tasks.fetchError'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddTask = async () => {
    if (!newTask.title.trim()) {
      toast.error(t('tasks.titleRequired'));
      return;
    }

    setIsAddingTask(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('tasks')
        .insert({
          user_id: user.id,
          report_id: reportId || null,
          title: newTask.title,
          description: newTask.description || null,
          priority: newTask.priority,
          status: 'pending'
        })
        .select()
        .single();

      if (error) throw error;
      
      setTasks(prev => [data as Task, ...prev]);
      setNewTask({ title: '', description: '', priority: 'medium' });
      setShowAddDialog(false);
      toast.success(t('tasks.taskAdded'));
    } catch (error) {
      console.error('Error adding task:', error);
      toast.error(t('tasks.addError'));
    } finally {
      setIsAddingTask(false);
    }
  };

  const handleSuggestTasks = async (transcribedText?: string) => {
    setIsSuggestingTasks(true);
    try {
      const { data, error } = await supabase.functions.invoke('suggest-tasks', {
        body: { 
          context: transcribedText || 'Field work project management',
          projectName: reportId ? 'Current Project' : 'General Tasks'
        }
      });

      if (error) throw error;
      
      if (data?.suggestions && data.suggestions.length > 0) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        const tasksToInsert = data.suggestions.map((s: any) => ({
          user_id: user.id,
          report_id: reportId || null,
          title: s.title,
          description: s.description || null,
          priority: s.priority || 'medium',
          status: 'pending'
        }));

        const { data: insertedTasks, error: insertError } = await supabase
          .from('tasks')
          .insert(tasksToInsert)
          .select();

        if (insertError) throw insertError;
        
        setTasks(prev => [...(insertedTasks as Task[]), ...prev]);
        toast.success(t('tasks.suggestionsAdded', { count: data.suggestions.length }));
      } else {
        toast.info(t('tasks.noSuggestions'));
      }
    } catch (error: any) {
      console.error('Error suggesting tasks:', error);
      if (error.message?.includes('429')) {
        toast.error(t('tasks.rateLimitError'));
      } else if (error.message?.includes('402')) {
        toast.error(t('tasks.creditsError'));
      } else {
        toast.error(t('tasks.suggestError'));
      }
    } finally {
      setIsSuggestingTasks(false);
    }
  };

  const handleVoiceRecord = async () => {
    if (!isRecording) {
      // Start recording
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        
        const mimeTypes = [
          'audio/webm',
          'audio/webm;codecs=opus',
          'audio/mp4',
          'audio/mpeg',
          'audio/wav'
        ];
        
        let selectedMimeType = '';
        for (const mimeType of mimeTypes) {
          if (MediaRecorder.isTypeSupported(mimeType)) {
            selectedMimeType = mimeType;
            break;
          }
        }
        
        const recorderOptions = selectedMimeType ? { mimeType: selectedMimeType } : {};
        const recorder = new MediaRecorder(stream, recorderOptions);
        const chunks: Blob[] = [];

        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) {
            chunks.push(e.data);
          }
        };

        recorder.onstop = async () => {
          const audioBlob = new Blob(chunks, { type: recorder.mimeType });
          stream.getTracks().forEach(track => track.stop());
          await transcribeAndCreateTasks(audioBlob);
        };

        recorder.start();
        setMediaRecorder(recorder);
        setIsRecording(true);
        toast.success(t('tasks.recordingStarted'));
      } catch (error) {
        console.error("Error accessing microphone:", error);
        toast.error(t('tasks.microphoneError'));
      }
    } else {
      // Stop recording
      if (mediaRecorder) {
        mediaRecorder.stop();
        setMediaRecorder(null);
        setIsRecording(false);
        toast.success(t('tasks.processingVoice'));
      }
    }
  };

  const transcribeAndCreateTasks = async (audioBlob: Blob) => {
    setIsProcessingVoice(true);
    try {
      // Convert blob to base64
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      
      reader.onloadend = async () => {
        const base64Audio = reader.result as string;
        const base64Data = base64Audio.split(',')[1];

        // First, transcribe the audio
        const { data: transcriptionData, error: transcriptionError } = await supabase.functions.invoke('transcribe-audio', {
          body: { audio: base64Data }
        });

        if (transcriptionError) {
          console.error("Transcription error:", transcriptionError);
          toast.error(t('tasks.transcriptionFailed'));
          setIsProcessingVoice(false);
          return;
        }

        if (transcriptionData?.text) {
          toast.success(t('tasks.voiceTranscribed'));
          // Use the transcribed text to generate task suggestions
          await handleSuggestTasks(transcriptionData.text);
        } else {
          toast.error(t('tasks.noVoiceDetected'));
        }
        
        setIsProcessingVoice(false);
      };
    } catch (error) {
      console.error("Error transcribing audio:", error);
      toast.error(t('tasks.transcriptionFailed'));
      setIsProcessingVoice(false);
    }
  };

  const handleToggleStatus = async (task: Task) => {
    const newStatus = task.status === 'completed' ? 'pending' : 'completed';
    
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ status: newStatus })
        .eq('id', task.id);

      if (error) throw error;
      
      setTasks(prev => prev.map(t => 
        t.id === task.id ? { ...t, status: newStatus } : t
      ));
    } catch (error) {
      console.error('Error updating task:', error);
      toast.error(t('tasks.updateError'));
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskId);

      if (error) throw error;
      
      setTasks(prev => prev.filter(t => t.id !== taskId));
      toast.success(t('tasks.taskDeleted'));
    } catch (error) {
      console.error('Error deleting task:', error);
      toast.error(t('tasks.deleteError'));
    }
  };

  const filteredTasks = tasks.filter(task => {
    if (filter === 'all') return true;
    return task.status === filter;
  });

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-destructive';
      case 'medium': return 'text-yellow-500';
      case 'low': return 'text-muted-foreground';
      default: return 'text-muted-foreground';
    }
  };

  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case 'high': return t('tasks.priorityHigh');
      case 'medium': return t('tasks.priorityMedium');
      case 'low': return t('tasks.priorityLow');
      default: return priority;
    }
  };

  const isVoiceProcessing = isRecording || isProcessingVoice || isSuggestingTasks;

  const handleProjectSelected = async (selectedProjectId: string, selectedProjectName: string) => {
    try {
      // Update all user's tasks that don't have a report_id to link to this project
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('tasks')
        .update({ report_id: selectedProjectId })
        .eq('user_id', user.id)
        .is('report_id', null);

      if (error) throw error;

      setReportId(selectedProjectId);
      setProjectName(selectedProjectName);
      toast.success(t('tasks.linkedToProject', { project: selectedProjectName }));
      fetchTasks();
    } catch (error) {
      console.error('Error linking tasks to project:', error);
      toast.error(t('tasks.linkError'));
    }
  };

  return (
    <div className="dark min-h-screen bg-background">
      <GlassNavbar fixed={false}>
        <NavbarLeft>
          <BackButton fallbackPath="/capture-screen" />
        </NavbarLeft>
        <NavbarCenter>
          <NavbarTitle>{t('tasks.title')}</NavbarTitle>
        </NavbarCenter>
        <NavbarRight>
          <SettingsButton />
        </NavbarRight>
      </GlassNavbar>

      <main className="flex-1 px-4 pt-4 pb-24 animate-fade-in">
        {/* Project Badge & Actions */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            {projectName ? (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 rounded-lg text-sm">
                <FolderOpen className="h-4 w-4 text-primary" />
                <span className="text-foreground">{projectName}</span>
              </div>
            ) : isSimpleMode ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowProjectSelector(true)}
                className="gap-2"
              >
                <FolderOpen className="h-4 w-4" />
                {t('tasks.linkToProject')}
              </Button>
            ) : null}
          </div>
          <TaskActionsBar 
            tasks={tasks} 
            projectName={projectName} 
            reportId={reportId}
            onSaveToProject={() => setShowProjectSelector(true)}
          />
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 mb-6">
          <Button
            onClick={() => setShowAddDialog(true)}
            className="flex-1 gap-2"
          >
            <Plus className="h-4 w-4" />
            {t('tasks.addTask')}
          </Button>
          <Button
            onClick={() => handleSuggestTasks()}
            disabled={isSuggestingTasks}
            variant="secondary"
            className="flex-1 gap-2"
          >
            {isSuggestingTasks ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {t('tasks.aiSuggest')}
          </Button>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {(['all', 'pending', 'in_progress', 'completed'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                filter === f
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-muted-foreground hover:bg-secondary/80'
              }`}
            >
              {t(`tasks.filter${f.charAt(0).toUpperCase() + f.slice(1).replace('_', '')}`)}
            </button>
          ))}
        </div>

        {/* Voice Input Section */}
        <div className="mb-6">
          <button
            onClick={handleVoiceRecord}
            disabled={isProcessingVoice || isSuggestingTasks}
            className={`flex w-full cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl p-6 text-center transition-all ${
              isRecording 
                ? 'bg-destructive/20 ring-4 ring-destructive/30 animate-pulse' 
                : 'bg-primary/20 hover:bg-primary/30 shadow-xl shadow-primary/50 ring-4 ring-primary/30'
            }`}
          >
            <div className="flex items-center gap-3">
              {isRecording ? (
                <MicOff className="h-12 w-12 text-destructive" />
              ) : isProcessingVoice || isSuggestingTasks ? (
                <Loader2 className="h-12 w-12 text-primary animate-spin" />
              ) : (
                <Mic className="h-12 w-12 text-primary" />
              )}
            </div>
            <p className="text-sm font-bold text-foreground">
              {isRecording 
                ? t('tasks.tapToStop')
                : isProcessingVoice 
                ? t('tasks.processingVoice')
                : isSuggestingTasks
                ? t('tasks.creatingTasks')
                : t('tasks.tapToRecord')
              }
            </p>
            <p className="text-xs text-muted-foreground">
              {t('tasks.voiceHint')}
            </p>
          </button>
        </div>

        {/* Tasks List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <CheckCircle2 className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">{t('tasks.noTasks')}</p>
            <p className="text-sm text-muted-foreground mt-1">{t('tasks.noTasksHint')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredTasks.map((task) => (
              <div
                key={task.id}
                className={`flex items-start gap-3 p-4 rounded-xl bg-card border border-border transition-all ${
                  task.status === 'completed' ? 'opacity-60' : ''
                }`}
              >
                <button
                  onClick={() => handleToggleStatus(task)}
                  className="mt-0.5 flex-shrink-0"
                >
                  {task.status === 'completed' ? (
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                  ) : (
                    <Circle className="h-5 w-5 text-muted-foreground hover:text-primary transition-colors" />
                  )}
                </button>
                
                <div className="flex-1 min-w-0">
                  <h3 className={`font-medium ${task.status === 'completed' ? 'line-through' : ''}`}>
                    {task.title}
                  </h3>
                  {task.description && (
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                      {task.description}
                    </p>
                  )}
                  <div className="flex items-center gap-3 mt-2">
                    <span className={`flex items-center gap-1 text-xs ${getPriorityColor(task.priority)}`}>
                      <Flag className="h-3 w-3" />
                      {getPriorityLabel(task.priority)}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {new Date(task.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => setPhotoPickerTaskId(task.id)}
                  className="flex-shrink-0 p-2 text-muted-foreground hover:text-primary transition-colors"
                  title={t('mediaLink.linkToPhoto')}
                >
                  <ImageIcon className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleDeleteTask(task.id)}
                  className="flex-shrink-0 p-2 text-muted-foreground hover:text-destructive transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Add Task Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('tasks.addTaskTitle')}</DialogTitle>
            <DialogDescription>{t('tasks.addTaskDescription')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div>
              <Input
                placeholder={t('tasks.taskTitlePlaceholder')}
                value={newTask.title}
                onChange={(e) => setNewTask(prev => ({ ...prev, title: e.target.value }))}
              />
            </div>
            <div>
              <Textarea
                placeholder={t('tasks.taskDescriptionPlaceholder')}
                value={newTask.description}
                onChange={(e) => setNewTask(prev => ({ ...prev, description: e.target.value }))}
                className="min-h-[100px]"
              />
            </div>
            <div>
              <Select
                value={newTask.priority}
                onValueChange={(value: 'low' | 'medium' | 'high') => 
                  setNewTask(prev => ({ ...prev, priority: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('tasks.selectPriority')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">{t('tasks.priorityLow')}</SelectItem>
                  <SelectItem value="medium">{t('tasks.priorityMedium')}</SelectItem>
                  <SelectItem value="high">{t('tasks.priorityHigh')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={handleAddTask}
              disabled={isAddingTask}
              className="w-full"
            >
              {isAddingTask ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              {t('tasks.addTask')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Project Selector Dialog */}
      <TaskProjectSelector
        open={showProjectSelector}
        onOpenChange={setShowProjectSelector}
        onProjectSelected={handleProjectSelected}
        currentProjectId={reportId}
      />

      {/* Photo Picker Dialog */}
      <PhotoPickerDialog
        open={!!photoPickerTaskId}
        onOpenChange={(open) => { if (!open) setPhotoPickerTaskId(null); }}
        onSelect={async (mediaId) => {
          if (!photoPickerTaskId) return;
          try {
            const { error } = await supabase
              .from('tasks')
              .update({ media_id: mediaId })
              .eq('id', photoPickerTaskId);
            if (error) throw error;
            toast.success(t('mediaLink.taskAdded'));
            setPhotoPickerTaskId(null);
          } catch (error) {
            console.error('Error linking task to photo:', error);
            toast.error(t('mediaLink.addError'));
          }
        }}
      />
    </div>
  );
};

export default Tasks;
