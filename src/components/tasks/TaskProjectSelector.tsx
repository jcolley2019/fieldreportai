import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FolderOpen, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface Project {
  id: string;
  project_name: string;
  customer_name: string;
}

interface TaskProjectSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onProjectSelected: (projectId: string, projectName: string) => void;
  currentProjectId?: string;
}

export const TaskProjectSelector = ({ 
  open, 
  onOpenChange, 
  onProjectSelected,
  currentProjectId 
}: TaskProjectSelectorProps) => {
  const { t } = useTranslation();
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedProjectId, setSelectedProjectId] = useState<string>(currentProjectId || '');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (open) {
      fetchProjects();
    }
  }, [open]);

  const fetchProjects = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('reports')
        .select('id, project_name, customer_name')
        .eq('user_id', user.id)
        .is('parent_report_id', null)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProjects(data || []);
    } catch (error) {
      console.error('Error fetching projects:', error);
      toast.error(t('common.loadError'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = () => {
    if (!selectedProjectId) {
      toast.error(t('tasks.selectProjectRequired'));
      return;
    }

    const project = projects.find(p => p.id === selectedProjectId);
    if (project) {
      onProjectSelected(project.id, project.project_name);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5" />
            {t('tasks.linkToProject')}
          </DialogTitle>
          <DialogDescription>
            {t('tasks.linkToProjectDescription')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-4">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : projects.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">{t('tasks.noProjectsAvailable')}</p>
            </div>
          ) : (
            <>
              <Select
                value={selectedProjectId}
                onValueChange={setSelectedProjectId}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('tasks.selectProject')} />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      <div className="flex flex-col">
                        <span>{project.project_name}</span>
                        <span className="text-xs text-muted-foreground">{project.customer_name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  className="flex-1"
                >
                  {t('common.cancel')}
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={!selectedProjectId || isSaving}
                  className="flex-1"
                >
                  {isSaving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  {t('tasks.linkTasks')}
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
