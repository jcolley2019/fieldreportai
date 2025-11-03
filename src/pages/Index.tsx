import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { User } from "@supabase/supabase-js";
import { 
  FileText, 
  Camera, 
  Mic, 
  ChevronDown, 
  Plus,
  Share2,
  Eye
} from "lucide-react";
import { toast } from "@/hooks/use-toast";

type ReportStatus = "submitted" | "in-progress";

interface Report {
  id: string;
  title: string;
  date: string;
  status: ReportStatus;
}

const Index = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const mockReports: Report[] = [
    { id: "1", title: "Site Walkthrough #102", date: "Oct 26, 2023", status: "submitted" },
    { id: "2", title: "Safety Inspection Q4", date: "Oct 25, 2023", status: "in-progress" },
    { id: "3", title: "Foundation Pour Observation", date: "Oct 24, 2023", status: "submitted" },
    { id: "4", title: "HVAC Unit Installation", date: "Oct 23, 2023", status: "submitted" },
    { id: "5", title: "Electrical Wiring Check", date: "Oct 22, 2023", status: "submitted" },
  ];

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

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const handleQuickAdd = (type: string) => {
    toast({
      title: `Add ${type}`,
      description: `${type} feature coming soon!`,
    });
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
    <div className="dark min-h-screen">
      <div className="flex min-h-screen w-full flex-col bg-background">
        {/* Header */}
        <header className="sticky top-0 z-10 flex items-center justify-between bg-background/80 px-4 py-3 backdrop-blur-sm border-b border-input">
          <button className="flex items-center gap-2 text-foreground hover:opacity-80 transition-opacity">
            <h1 className="text-lg font-bold">Project Alpha</h1>
            <ChevronDown className="h-5 w-5 text-muted-foreground" />
          </button>
          <Button
            onClick={() => toast({ title: "New Report", description: "Report creation coming soon!" })}
            className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg"
          >
            <Plus className="h-5 w-5 mr-1" />
            New Report
          </Button>
        </header>

        {/* Main Content */}
        <main className="flex-1 px-4 py-6 space-y-8">
          {/* Quick Add Section */}
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">Quick Add</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <button
                onClick={() => handleQuickAdd("Note")}
                className="flex flex-col items-center gap-3 p-6 rounded-lg bg-card border border-input hover:bg-accent/50 transition-colors"
              >
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/20">
                  <FileText className="h-8 w-8 text-primary" />
                </div>
                <span className="text-base font-medium text-foreground">Add Note</span>
              </button>

              <button
                onClick={() => handleQuickAdd("Photo")}
                className="flex flex-col items-center gap-3 p-6 rounded-lg bg-card border border-input hover:bg-accent/50 transition-colors"
              >
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/20">
                  <Camera className="h-8 w-8 text-primary" />
                </div>
                <span className="text-base font-medium text-foreground">Add Photo</span>
              </button>

              <button
                onClick={() => handleQuickAdd("Voice")}
                className="flex flex-col items-center gap-3 p-6 rounded-lg bg-card border border-input hover:bg-accent/50 transition-colors"
              >
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/20">
                  <Mic className="h-8 w-8 text-primary" />
                </div>
                <span className="text-base font-medium text-foreground">Add Voice</span>
              </button>
            </div>
          </section>

          {/* Recent Reports Section */}
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">Recent Reports</h2>
            <div className="space-y-3">
              {mockReports.map((report) => (
                <div
                  key={report.id}
                  className="flex items-center gap-4 p-4 rounded-lg bg-card border border-input hover:bg-accent/30 transition-colors"
                >
                  {/* Icon */}
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-primary/20">
                    <FileText className="h-7 w-7 text-primary" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-semibold text-foreground truncate">
                      {report.title}
                    </h3>
                    <p className="text-sm text-muted-foreground">{report.date}</p>
                  </div>

                  {/* Status */}
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-primary/50" />
                    <span className={`text-sm font-medium ${
                      report.status === "in-progress" 
                        ? "text-yellow-500" 
                        : "text-muted-foreground"
                    }`}>
                      {report.status === "in-progress" ? "In Progress" : "Submitted"}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toast({ title: "Share", description: "Share feature coming soon!" })}
                      className="p-2 text-muted-foreground hover:text-foreground transition-colors"
                      aria-label="Share report"
                    >
                      <Share2 className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => toast({ title: "View Report", description: "Viewing report details coming soon!" })}
                      className="p-2 text-muted-foreground hover:text-foreground transition-colors"
                      aria-label="View report"
                    >
                      <Eye className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Logout Button */}
          <div className="pt-4 border-t border-input">
            <Button
              onClick={handleLogout}
              variant="outline"
              className="w-full sm:w-auto"
            >
              Log Out
            </Button>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Index;
