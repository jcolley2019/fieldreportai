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
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Sparkles, Trash2, Clock, Flag, CheckCircle2, Circle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

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
  const reportId = location.state?.reportId;

  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [isSuggestingTasks, setIsSuggestingTasks] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newTask, setNewTask] = useState<{ title: string; description: string; priority: 'low' | 'medium' | 'high' }>({ title: '', description: '', priority: 'medium' });
  const [filter, setFilter] = useState<'all' | 'pending' | 'in_progress' | 'completed'>('all');

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

  const handleSuggestTasks = async () => {
    setIsSuggestingTasks(true);
    try {
      const { data, error } = await supabase.functions.invoke('suggest-tasks', {
        body: { 
          context: 'Field work project management',
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

  return (
    <div className="dark min-h-screen bg-background">
      <GlassNavbar fixed={false}>
        <NavbarLeft>
          <BackButton />
        </NavbarLeft>
        <NavbarCenter>
          <NavbarTitle>{t('tasks.title')}</NavbarTitle>
        </NavbarCenter>
        <NavbarRight>
          <SettingsButton />
        </NavbarRight>
      </GlassNavbar>

      <main className="flex-1 px-4 pt-4 pb-24 animate-fade-in">
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
            onClick={handleSuggestTasks}
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
    </div>
  );
};

export default Tasks;
