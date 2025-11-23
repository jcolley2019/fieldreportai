import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { User } from "@supabase/supabase-js";
import { FileText, Camera, Mic, Share2, Eye, ChevronDown, Settings as SettingsIcon, ListChecks, Building2, Hash, User as UserIcon, Trash2, Zap, FolderOpen, Search, Filter, Plus } from "lucide-react";
import { toast } from "sonner";
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
      .select('first_name, last_name, company_name')
      .eq('id', user.id)
      .single();

    const isProfileComplete = profile?.first_name && profile?.last_name && profile?.company_name;
    
    if (!isProfileComplete) {
      navigate("/onboarding");
    }
  };

  useEffect(() => {
    if (user) {
      fetchProjects();
    }
  }, [user]);

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
        <button className="flex items-center gap-2">
          <h1 className="text-lg font-bold text-foreground">Project Alpha</h1>
          <ChevronDown className="h-5 w-5 text-muted-foreground" />
        </button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/settings")}
        >
          <SettingsIcon className="h-5 w-5 text-foreground" />
        </Button>
      </header>

      <main className="p-4">
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

        {/* Projects/Customers Section */}
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-2xl font-semibold text-foreground">Projects & Customers</h2>
          </div>
          
          {/* Search and Filter */}
          {projects.length > 0 && (
            <div className="mb-4 flex flex-col gap-3 sm:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search projects, customers, or job numbers..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 bg-card border-border text-foreground placeholder:text-muted-foreground"
                />
              </div>
              <Select value={sortBy} onValueChange={(value: "recent" | "name" | "customer") => setSortBy(value)}>
                <SelectTrigger className="w-full sm:w-[180px] bg-card border-border text-foreground">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="recent">Most Recent</SelectItem>
                  <SelectItem value="name">Project Name</SelectItem>
                  <SelectItem value="customer">Customer Name</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          
          {projects.length === 0 ? (
            <div className="rounded-lg bg-card p-8 text-center">
              <FileText className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
              <p className="text-muted-foreground">No projects yet. Create your first project to get started!</p>
            </div>
          ) : filteredProjects.length === 0 ? (
            <div className="rounded-lg bg-card p-8 text-center">
              <Search className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
              <p className="text-muted-foreground">No projects found matching "{searchQuery}"</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredProjects.map((project) => (
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
