import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { User } from "@supabase/supabase-js";
import { FileText, Camera, Mic, Share2, Eye, ChevronDown, ChevronRight, Settings as SettingsIcon, ListChecks, Building2, Hash, User as UserIcon, Trash2, Zap, FolderOpen, Search, Filter, Plus, Circle, Cloud, Layers, LogOut } from "lucide-react";
import { toast } from "sonner";
import { TrialBanner } from "@/components/TrialBanner";
import { SubscriptionBadge } from "@/components/SubscriptionBadge";
import { TrialExpiredModal } from "@/components/TrialExpiredModal";
import { GlassNavbar, NavbarLeft, NavbarCenter, NavbarRight, NavbarTitle } from "@/components/GlassNavbar";
import { usePlanFeatures } from "@/hooks/usePlanFeatures";
import BetaCountdownBanner from "@/components/BetaCountdownBanner";
import GettingStartedGuide from "@/components/GettingStartedGuide";
import OfflineQueueCard from "@/components/OfflineQueueCard";
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
  const [searchParams, setSearchParams] = useSearchParams();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"recent" | "name" | "customer">("recent");
  const [showProjectDialog, setShowProjectDialog] = useState(false);
  const [trialStartDate, setTrialStartDate] = useState<string | null>(null);
  const [showTrialBanner, setShowTrialBanner] = useState(true);
  const [showTrialExpiredModal, setShowTrialExpiredModal] = useState(false);
  const [isUpgradeClicked, setIsUpgradeClicked] = useState(false);
  const [isProjectsSectionVisible, setIsProjectsSectionVisible] = useState(false);
  const navigate = useNavigate();
  const { refreshPlan, currentPlan, features, isTrialExpired, trialDaysExpired } = usePlanFeatures();

  // Show trial expired modal if trial has expired
  useEffect(() => {
    if (isTrialExpired && !loading) {
      // Show modal after a short delay to let the page load
      const timer = setTimeout(() => {
        setShowTrialExpiredModal(true);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [isTrialExpired, loading]);

  // Handle checkout success
  useEffect(() => {
    const checkoutStatus = searchParams.get('checkout');
    if (checkoutStatus === 'success') {
      toast.success(t('dashboard.subscriptionSuccess') || 'Subscription activated successfully!');
      refreshPlan();
      // Remove the query param
      setSearchParams({});
    }
  }, [searchParams, setSearchParams, refreshPlan, t]);

  useEffect(() => {
    let isMounted = true;

    // Safety timeout: force loading to false after 5 seconds
    const safetyTimeout = setTimeout(() => {
      if (isMounted && loading) {
        console.warn('Dashboard auth safety timeout triggered');
        setLoading(false);
      }
    }, 5000);

    // Listener for ONGOING auth changes (does NOT control loading)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!isMounted) return;
        setUser(session?.user ?? null);
        if (loading) setLoading(false);
      }
    );

    // INITIAL load (controls loading)
    const initializeAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (isMounted) {
          setUser(session?.user ?? null);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    initializeAuth();

    return () => {
      isMounted = false;
      clearTimeout(safetyTimeout);
      subscription.unsubscribe();
    };
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

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('trial_start_date, current_plan')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError) {
      console.error('Error fetching profile:', profileError);
      return;
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
      <BetaCountdownBanner />
      {/* Glass Navbar */}
      <GlassNavbar fixed={false}>
        <NavbarLeft>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 hover:bg-muted/40 rounded-xl px-3 py-2 transition-all duration-200">
                <h1 className="text-base font-medium text-foreground">{t('dashboard.menu')}</h1>
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64">
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
                  <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
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
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={async () => {
                  await supabase.auth.signOut();
                  navigate("/auth");
                }} 
                className="cursor-pointer text-destructive focus:text-destructive"
              >
                <LogOut className="mr-2 h-4 w-4" />
                {t('settings.logOut')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </NavbarLeft>
        
        <NavbarCenter>
          <div className="flex items-center gap-3">
            <NavbarTitle>Dashboard</NavbarTitle>
            <SubscriptionBadge plan={currentPlan} />
          </div>
        </NavbarCenter>
        
        <NavbarRight>
          {new Date() >= new Date("2026-03-01T00:00:00") && (!currentPlan || currentPlan === 'trial') && (
            <Button
              onClick={() => {
                setIsUpgradeClicked(true);
                setTimeout(() => {
                  setIsUpgradeClicked(false);
                  navigate("/pricing");
                }, 200);
              }}
              size="sm"
              className={`gap-1.5 text-sm md:text-base px-2.5 md:px-4 py-1.5 md:py-2 bg-gradient-to-r from-primary to-primary/80 text-primary-foreground font-medium shadow-lg transition-all duration-300 ${isUpgradeClicked ? "scale-95" : "hover:scale-105 hover:shadow-[0_0_20px_hsl(var(--primary)/0.5)] hover:from-primary/90 hover:to-primary"}`}
            >
              <Zap className="h-3.5 w-3.5 md:h-4 md:w-4 fill-current" />
              <span className="hidden sm:inline">{t('dashboard.upgradeNow')}</span>
              <span className="sm:hidden">Upgrade</span>
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/settings")}
            className="rounded-xl hover:bg-muted/40 h-10 w-10"
          >
            <SettingsIcon className="h-6 w-6 text-foreground" />
          </Button>
        </NavbarRight>
      </GlassNavbar>

      <main className="p-4 pt-6 animate-fade-in">
        {/* Trial Banner */}
        {trialStartDate && showTrialBanner && (
          <TrialBanner 
            trialStartDate={trialStartDate} 
            onDismiss={() => setShowTrialBanner(false)}
          />
        )}
        
        {/* Getting Started Guide */}
        <GettingStartedGuide userId={user?.id} />

        {/* Offline Queue */}
        <OfflineQueueCard />

        {/* Mode Selection Section */}
        <section className="mb-8">
          <h2 className="mb-6 text-2xl font-semibold text-foreground">{t('dashboard.chooseWorkflow')}</h2>
          <div className="grid grid-cols-2 gap-5">
            <button 
              onClick={() => navigate("/capture-screen", { state: { simpleMode: true } })}
              className="glass-card flex flex-col items-center gap-5 p-8 hover-lift group"
            >
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/15 transition-all duration-300 group-hover:bg-primary/25 group-hover:shadow-glow-blue">
                <Zap className="h-10 w-10 text-primary transition-transform duration-300 group-hover:scale-110" />
              </div>
              <div className="text-center">
                <h3 className="text-lg font-semibold text-foreground mb-1">{t('dashboard.simpleMode')}</h3>
                <p className="text-sm text-muted-foreground">{t('dashboard.quickReports')}</p>
              </div>
            </button>
            <button 
              onClick={() => setShowProjectDialog(true)}
              className="glass-card flex flex-col items-center gap-5 p-8 hover-lift group"
            >
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/15 transition-all duration-300 group-hover:bg-primary/25 group-hover:shadow-glow-blue">
                <FolderOpen className="h-10 w-10 text-primary transition-transform duration-300 group-hover:scale-110" />
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
            <div className="glass-card p-8 text-center">
              <Building2 className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
              <p className="text-muted-foreground">{t('dashboard.noProjects')}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredProjects.slice(0, 5).map((project) => (
                <div
                  key={project.id}
                  className="glass-card flex items-start gap-4 p-4 hover-lift cursor-pointer group"
                  onClick={() => navigate(`/project/${project.id}`)}
                >
                  <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl bg-primary/15 transition-all duration-300 group-hover:bg-primary/25">
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
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/project/${project.id}`);
                      }}
                      className="rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/40"
                    >
                      <Eye className="h-5 w-5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`${t('dashboard.deleteConfirm')} "${project.project_name}"?`)) {
                          handleDeleteProject(project.id);
                        }
                      }}
                      className="rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10"
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

      {/* Trial Expired Modal */}
      <TrialExpiredModal 
        open={showTrialExpiredModal} 
        onOpenChange={setShowTrialExpiredModal}
        daysExpired={trialDaysExpired}
      />
    </div>
  );
};

export default Index;
