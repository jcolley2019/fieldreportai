import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
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
    
    if (!isProfileComplete) {
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
      toast.error('Failed to load projects');
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

      toast.success('Project deleted successfully');
      fetchProjects();
    } catch (error) {
      console.error('Error deleting project:', error);
      toast.error('Failed to delete project');
    }
  };

  if (loading) {
    return (
      <div className="dark min-h-screen">
        <div className="flex min-h-screen items-center justify-center bg-background">
          <div className="text-foreground">Loading...</div>
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
      <header className="sticky top-0 z-10 flex items-center justify-between bg-background/80 px-4 py-3 backdrop-blur-sm">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 hover:bg-secondary rounded-md px-2 py-1 transition-colors">
              <h1 className="text-lg font-bold text-foreground">Menu</h1>
              <ChevronDown className="h-5 w-5 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64 bg-popover">
            <DropdownMenuItem onClick={() => navigate("/new-project")} className="cursor-pointer">
              <Plus className="mr-2 h-4 w-4" />
              New Project
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate("/projects")} className="cursor-pointer">
              <FolderOpen className="mr-2 h-4 w-4" />
              View All Projects
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate("/capture-screen", { state: { simpleMode: true } })} className="cursor-pointer">
              <Camera className="mr-2 h-4 w-4" />
              Capture Screen
            </DropdownMenuItem>
            
            {/* Recent Projects Section */}
            {projects.length > 0 && (
              <>
                <DropdownMenuSeparator />
                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                  Recent Projects
                </div>
                {projects.slice(0, 5).map((project) => (
                  <DropdownMenuItem 
                    key={project.id}
                    onClick={() => toast.info(`View project: ${project.project_name}`)}
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
            <DropdownMenuItem onClick={() => navigate("/leads")} className="cursor-pointer">
              <Hash className="mr-2 h-4 w-4" />
              Leads Dashboard
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate("/all-content")} className="cursor-pointer">
              <Layers className="mr-2 h-4 w-4" />
              All Content
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate("/saved-notes")} className="cursor-pointer">
              <Mic className="mr-2 h-4 w-4" />
              Saved Notes
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate("/saved-reports")} className="cursor-pointer">
              <Cloud className="mr-2 h-4 w-4" />
              Saved Reports
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate("/settings")} className="cursor-pointer">
              <SettingsIcon className="mr-2 h-4 w-4" />
              Settings
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
            Upgrade Now
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/settings")}
          >
            <SettingsIcon className="h-5 w-5 text-foreground" />
          </Button>
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
          <h2 className="mb-4 text-2xl font-semibold text-foreground">Choose Your Workflow</h2>
          <div className="grid grid-cols-2 gap-4">
            <button 
              onClick={() => navigate("/capture-screen", { state: { simpleMode: true } })}
              className="flex flex-col items-center gap-4 rounded-lg bg-card p-8 transition-colors hover:bg-secondary"
            >
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
                <Zap className="h-10 w-10 text-primary" />
              </div>
              <div className="text-center">
                <h3 className="text-lg font-semibold text-foreground mb-1">Simple Mode</h3>
                <p className="text-sm text-muted-foreground">Create quick standalone reports</p>
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
                <h3 className="text-lg font-semibold text-foreground mb-1">Project Mode</h3>
                <p className="text-sm text-muted-foreground">Manage projects and customers</p>
              </div>
            </button>
          </div>
        </section>

        {/* Recent Projects Section */}
        <section id="projects-section">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-2xl font-semibold text-foreground">Recent Projects</h2>
            {projects.length > 5 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("/projects")}
                className="gap-2"
              >
                View All
                <ChevronRight className="h-4 w-4" />
              </Button>
            )}
          </div>
          
          {projects.length === 0 ? (
            <div className="rounded-lg bg-card p-8 text-center">
              <Building2 className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
              <p className="text-muted-foreground mb-4">No projects yet. Create your first project to get started!</p>
              <Button onClick={() => navigate("/new-project")}>
                <Plus className="mr-2 h-4 w-4" />
                Create Project
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
                        <span>{project.checklist_count} checklist{project.checklist_count !== 1 ? 's' : ''}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => toast.info(`View project: ${project.project_name}`)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <Eye className="h-5 w-5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        if (confirm(`Are you sure you want to delete "${project.project_name}"?`)) {
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
            <DialogTitle className="text-foreground">Project Mode</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Create comprehensive field reports and checklists linked to a specific project or customer
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Instructions */}
            <div className="rounded-lg bg-primary/10 border border-primary/20 p-4">
              <h4 className="font-semibold text-foreground mb-2">How It Works:</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Create or select a project to organize your reports</li>
                <li>• Add photos, notes, and checklists to the project</li>
                <li>• All data is saved and linked to the project</li>
                <li>• Generate comprehensive reports anytime</li>
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
              Create New Project/Customer
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
                      Or select existing
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
                  No projects yet. Create your first project to get started!
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
