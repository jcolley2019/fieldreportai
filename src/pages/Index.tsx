import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { User } from "@supabase/supabase-js";
import { FileText, Camera, Mic, Share2, Eye, ChevronDown, Settings as SettingsIcon, ListChecks } from "lucide-react";
import { toast } from "sonner";

const Index = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
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
    }
  }, [user, loading, navigate]);

  const mockReports = [
    { id: 1, title: "Site Walkthrough #102", date: "Oct 26, 2023", status: "Submitted" },
    { id: 2, title: "Safety Inspection Q4", date: "Oct 25, 2023", status: "In Progress", statusColor: "text-yellow-500" },
    { id: 3, title: "Foundation Pour Observation", date: "Oct 24, 2023", status: "Submitted" },
    { id: 4, title: "HVAC Unit Installation", date: "Oct 23, 2023", status: "Submitted" },
    { id: 5, title: "Electrical Wiring Check", date: "Oct 22, 2023", status: "Submitted" },
  ];

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
        <div className="flex gap-2">
          <Button 
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={() => navigate("/new-report")}
          >
            + New Report
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
        {/* Quick Add Section */}
        <section className="mb-8">
          <h2 className="mb-4 text-2xl font-semibold text-foreground">Quick Add</h2>
          <div className="grid grid-cols-3 gap-4">
            <button 
              onClick={() => toast.success("Add Note clicked")}
              className="flex flex-col items-center gap-3 rounded-lg bg-card p-6 transition-colors hover:bg-secondary"
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                <FileText className="h-8 w-8 text-primary" />
              </div>
              <span className="text-sm font-medium text-foreground">Add Note</span>
            </button>
            <button 
              onClick={() => navigate("/capture-screen")}
              className="flex flex-col items-center gap-3 rounded-lg bg-card p-6 transition-colors hover:bg-secondary"
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                <Camera className="h-8 w-8 text-primary" />
              </div>
              <span className="text-sm font-medium text-foreground">Add Photo</span>
            </button>
            <button 
              onClick={() => toast.success("Add Checklist clicked")}
              className="flex flex-col items-center gap-3 rounded-lg bg-card p-6 transition-colors hover:bg-secondary"
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                <ListChecks className="h-8 w-8 text-primary" />
              </div>
              <span className="text-sm font-medium text-foreground">Checklist</span>
            </button>
          </div>
        </section>

        {/* Recent Reports Section */}
        <section>
          <h2 className="mb-4 text-2xl font-semibold text-foreground">Recent Reports</h2>
          <div className="space-y-3">
            {mockReports.map((report) => (
              <div
                key={report.id}
                className="flex items-center gap-4 rounded-lg bg-card p-4"
              >
                <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-lg bg-muted">
                  <FileText className="h-7 w-7 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-foreground">{report.title}</h3>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">{report.date}</span>
                    <span className="text-muted-foreground">•</span>
                    <span className={report.statusColor || "text-muted-foreground"}>
                      {report.status}
                    </span>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button 
                    onClick={() => toast.success("Share clicked")}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <Share2 className="h-5 w-5" />
                  </button>
                  <button 
                    onClick={() => toast.success("View clicked")}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <Eye className="h-5 w-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
};

export default Index;
