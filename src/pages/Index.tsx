import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { User } from "@supabase/supabase-js";
import { FileText, Camera, Mic, Share2, Eye, ChevronDown, ChevronRight, Settings as SettingsIcon, ListChecks, Building2, Hash, User as UserIcon, Trash2, Zap, FolderOpen, Search, Filter, Plus, Circle, Cloud, Layers } from "lucide-react";
import { toast } from "sonner";
import { TrialBanner } from "@/components/TrialBanner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Project {
  id: string;
  project_name: string;
  customer_name: string;
  job_number: string;
  job_description: string;
  created_at: string;
  checklist_count: number;
}

const Index = () => {
  const { t } = useTranslation();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"recent" | "name" | "customer">("recent");
  const [showProjectDialog, setShowProjectDialog] = useState(false);
  const [trialStartDate, setTrialStartDate] = useState<string | null>(null);
  const [showTrialBanner, setShowTrialBanner] = useState(true);
  const [isUpgradeClicked, setIsUpgradeClicked] = useState(false);
  const [isProjectsSectionVisible, setIsProjectsSectionVisible] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    } else if (!loading && user) {
      checkProfileComplete();
    }
  }, [user, loading, navigate]);

  const checkProfileComplete = async () => {
    if (!user) return;

    const { data: profile } = await supabase
      .from('profiles')
      .select('first_name, last_name, company_name, trial_start_date, current_plan')
      .eq('id', user.id)
      .single();

    const isProfileComplete = profile?.first_name && profile?.last_name && profile?.company_name;
    const skipOnboarding = localStorage.getItem('skipOnboarding') === 'true';
    
    if (!isProfileComplete && !skipOnboarding) {
      navigate("/onboarding");
    }

    // Check if user is on trial and set trial start date
    if (profile?.current_plan === 'trial' && profile?.trial_start_date) {
      setTrialStartDate(profile.trial_start_date);
    }
  };

  useEffect(() => {
    if (user) {
      fetchProjects();
    }
  }, [user]);

  useEffect(() => {
    // Set up intersection observer for projects section
    const projectsSection = document.querySelector('#projects-section');
    if (!projectsSection) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          setIsProjectsSectionVisible(entry.isIntersecting);
        });
      },
      { threshold: 0.1 }
    );

    observer.observe(projectsSection);

    return () => observer.disconnect();
  }, []);

  const fetchProjects = async () => {
    try {
      const { data: reportsData, error: reportsError } = await supabase
        .from('reports')
        .select('*')
        .order('created_at', { ascending: false });

      if (reportsError) throw reportsError;

      // Fetch checklist counts for each report
      const projectsWithCounts = await Promise.all(
        (reportsData || []).map(async (report) => {
          const { count, error: countError } = await supabase
            .from('checklists')
            .select('*', { count: 'exact', head: true })
            .eq('report_id', report.id);

          return {
            ...report,
            checklist_count: countError ? 0 : (count || 0)
          };
        })
      );

      setProjects(projectsWithCounts);
    } catch (error) {
      console.error('Error fetching projects:', error);
      toast.error(t('dashboard.failedLoadProjects'));
    }
  };

  // Filter and sort projects
  const filteredProjects = projects
    .filter((project) => {
      const searchLower = searchQuery.toLowerCase();
      return (
        project.project_name.toLowerCase().includes(searchLower) ||
        project.customer_name.toLowerCase().includes(searchLower) ||
        project.job_number.toLowerCase().includes(searchLower) ||
        project.job_description.toLowerCase().includes(searchLower)
      );
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

  const handleDeleteProject = async (projectId: string) => {
    try {
      const { error } = await supabase
        .from('reports')
        .delete()
        .eq('id', projectId);

      if (error) throw error;

      toast.success(t('dashboard.projectDeleted'));
      fetchProjects();
    } catch (error) {
      console.error('Error deleting project:', error);
      toast.error(t('dashboard.failedDeleteProject'));
    }
  };

  if (loading) {
    return (
      <div className="dark min-h-screen">
        <div className="flex min-h-screen items-center justify-center bg-background">
          <div className="text-foreground">{t('common.loading')}</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="dark min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b border-border">
        <div className="flex items-center justify-between px-4 py-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 hover:bg-secondary rounded-md px-2 py-1 transition-colors">
                <h1 className="text-lg font-semibold text-foreground">{t('dashboard.menu')}</h1>
                <ChevronDown className="h-5 w-5 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64 bg-popover">
              <DropdownMenuItem onClick={() => navigate("/new-project")} className="cursor-pointer">
                <Plus className="mr-2 h-4 w-4" />
                {t('dashboard.newProject')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate("/projects")} className="cursor-pointer">
                <FolderOpen className="mr-2 h-4 w-4" />
                {t('dashboard.viewAllProjects')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate("/capture-screen", { state: { simpleMode: true } })} className="cursor-pointer">
                <Camera className="mr-2 h-4 w-4" />
                {t('dashboard.captureScreen')}
              </DropdownMenuItem>
              
              {/* Recent Projects Section */}
              {projects.length > 0 && (
                <>
                  <DropdownMenuSeparator />
                  <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                    {t('dashboard.recentProjects')}
                  </div>
                  {projects.slice(0, 5).map((project) => (
                    <DropdownMenuItem 
                      key={project.id}
                      onClick={() => navigate(`/project/${project.id}`)}
                      className="cursor-pointer flex-col items-start gap-1"
                    >
                      <div className="flex items-center gap-2 w-full">
                        <Building2 className="h-4 w-4 flex-shrink-0 text-primary" />
                        <span className="font-medium truncate">{project.project_name}</span>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground ml-6">
                        <UserIcon className="h-3 w-3" />
                        <span className="truncate">{project.customer_name}</span>
                      </div>
                    </DropdownMenuItem>
                  ))}
                </>
              )}
              
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate("/all-content")} className="cursor-pointer">
                <Layers className="mr-2 h-4 w-4" />
                {t('dashboard.allContent')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate("/saved-notes")} className="cursor-pointer">
                <Mic className="mr-2 h-4 w-4" />
                {t('dashboard.savedNotes')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate("/saved-reports")} className="cursor-pointer">
                <Cloud className="mr-2 h-4 w-4" />
                {t('dashboard.savedReports')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate("/settings")} className="cursor-pointer">
                <SettingsIcon className="mr-2 h-4 w-4" />
                {t('common.settings')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => {
                setIsUpgradeClicked(true);
                setTimeout(() => {
                  setIsUpgradeClicked(false);
                  navigate("/pricing");
                }, 200);
              }}
              size="sm"
              className={`gap-2 transition-transform duration-200 ${isUpgradeClicked ? "scale-95" : "hover:scale-105"}`}
            >
              <Zap className="h-4 w-4" />
              {t('dashboard.upgradeNow')}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/settings")}
            >
              <SettingsIcon className="h-5 w-5 text-foreground" />
            </Button>
          </div>
        </div>
      </header>

      <main className="p-4">
        {/* Trial Banner */}
        {trialStartDate && showTrialBanner && (
          <TrialBanner 
            trialStartDate={trialStartDate} 
            onDismiss={() => setShowTrialBanner(false)}
          />
        )}
        
        {/* Mode Selection Section */}
        <section className="mb-8">
          <h2 className="mb-4 text-2xl font-semibold text-foreground">{t('dashboard.chooseWorkflow')}</h2>
          <div className="grid grid-cols-2 gap-4">
            <button 
              onClick={() => navigate("/capture-screen", { state: { simpleMode: true } })}
              className="flex flex-col items-center gap-4 rounded-lg bg-card p-8 transition-colors hover:bg-secondary"
            >
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
                <Zap className="h-10 w-10 text-primary" />
              </div>
              <div className="text-center">
                <h3 className="text-lg font-semibold text-foreground mb-1">{t('dashboard.simpleMode')}</h3>
                <p className="text-sm text-muted-foreground">{t('dashboard.quickReports')}</p>
              </div>
            </button>
            <button 
              onClick={() => setShowProjectDialog(true)}
              className="flex flex-col items-center gap-4 rounded-lg bg-card p-8 transition-colors hover:bg-secondary"
            >
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
                <FolderOpen className="h-10 w-10 text-primary" />
              </div>
              <div className="text-center">
                <h3 className="text-lg font-semibold text-foreground mb-1">{t('dashboard.projectMode')}</h3>
                <p className="text-sm text-muted-foreground">{t('dashboard.manageProjects')}</p>
              </div>
            </button>
          </div>
        </section>

        {/* Recent Projects Section */}
        <section id="projects-section">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-2xl font-semibold text-foreground">{t('dashboard.recentProjects')}</h2>
            {projects.length > 5 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("/projects")}
                className="gap-2"
              >
                {t('dashboard.viewAll')}
                <ChevronRight className="h-4 w-4" />
              </Button>
            )}
          </div>
          
          {projects.length === 0 ? (
            <div className="rounded-lg bg-card p-8 text-center">
              <Building2 className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
              <p className="text-muted-foreground mb-4">{t('dashboard.noProjects')}</p>
              <Button onClick={() => navigate("/new-project")}>
                <Plus className="mr-2 h-4 w-4" />
                {t('dashboard.createProject')}
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredProjects.slice(0, 5).map((project) => (
                <div
                  key={project.id}
                  className="flex items-start gap-4 rounded-lg bg-card p-4 hover:bg-secondary/50 transition-colors"
                >
                  <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <Building2 className="h-7 w-7 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-foreground text-lg mb-1">{project.project_name}</h3>
                    <div className="space-y-1 text-sm">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <UserIcon className="h-4 w-4 flex-shrink-0" />
                        <span className="truncate">{project.customer_name}</span>
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Hash className="h-4 w-4 flex-shrink-0" />
                        <span className="truncate">{project.job_number}</span>
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <ListChecks className="h-4 w-4 flex-shrink-0" />
                        <span>{project.checklist_count} {project.checklist_count !== 1 ? t('dashboard.checklists') : t('dashboard.checklist')}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => navigate(`/project/${project.id}`)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <Eye className="h-5 w-5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        if (confirm(`${t('dashboard.deleteConfirm')} "${project.project_name}"?`)) {
                          handleDeleteProject(project.id);
                        }
                      }}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-5 w-5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      {/* Project Selection Dialog */}
      <Dialog open={showProjectDialog} onOpenChange={setShowProjectDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground">{t('dashboard.projectModeDialog.title')}</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {t('dashboard.projectModeDialog.description')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Instructions */}
            <div className="rounded-lg bg-primary/10 border border-primary/20 p-4">
              <h4 className="font-semibold text-foreground mb-2">{t('dashboard.projectModeDialog.howItWorks')}</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• {t('dashboard.projectModeDialog.step1')}</li>
                <li>• {t('dashboard.projectModeDialog.step2')}</li>
                <li>• {t('dashboard.projectModeDialog.step3')}</li>
                <li>• {t('dashboard.projectModeDialog.step4')}</li>
              </ul>
            </div>

            {/* Create New Project Button */}
            <Button
              onClick={() => {
                setShowProjectDialog(false);
                navigate("/new-project");
              }}
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90 h-12"
            >
              <Plus className="mr-2 h-5 w-5" />
              {t('dashboard.projectModeDialog.createNew')}
            </Button>

            {/* Existing Projects */}
            {filteredProjects.length > 0 && (
              <>
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-border" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">
                      {t('dashboard.projectModeDialog.selectExisting')}
                    </span>
                  </div>
                </div>

                <div className="max-h-[300px] overflow-y-auto space-y-2">
                  {filteredProjects.map((project) => (
                    <button
                      key={project.id}
                      onClick={() => {
                        setShowProjectDialog(false);
                        toast.info(`Selected: ${project.project_name}`);
                        // TODO: Navigate to project detail page
                      }}
                      className="w-full text-left p-4 rounded-lg bg-card hover:bg-secondary transition-colors"
                    >
                      <h4 className="font-semibold text-foreground mb-1">
                        {project.project_name}
                      </h4>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <UserIcon className="h-3 w-3" />
                        <span className="truncate">{project.customer_name}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                        <Hash className="h-3 w-3" />
                        <span>{project.job_number}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}

            {projects.length === 0 && (
              <div className="text-center py-8">
                <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  {t('dashboard.noProjects')}
                </p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Index;
