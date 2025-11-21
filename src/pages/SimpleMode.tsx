import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { FileText, Camera, ListChecks, ArrowLeft, Share2, Download } from "lucide-react";
import { toast } from "sonner";

const SimpleMode = () => {
  const navigate = useNavigate();

  const reportHistory = [
    { id: "1", title: "Site Inspection - Alpha Project", date: "Oct 26, 2023" },
    { id: "2", title: "Quarterly Maintenance Review", date: "Oct 22, 2023" },
    { id: "3", title: "Final Walkthrough - Gamma Site", date: "Oct 19, 2023" },
  ];

  const handleShare = (title: string) => {
    toast.success(`Sharing ${title}...`);
  };

  const handleDownload = (title: string) => {
    toast.success(`Downloading ${title}...`);
  };

  return (
    <div className="dark min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 flex items-center justify-between bg-background/80 px-4 py-3 backdrop-blur-sm">
        <Button
          variant="ghost"
          onClick={() => navigate("/dashboard")}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="h-5 w-5 text-foreground" />
          <span className="text-foreground">Back to Dashboard</span>
        </Button>
      </header>

      <main className="p-4">
        <section className="mb-8">
          <h2 className="mb-2 text-2xl font-semibold text-foreground">Simple Mode</h2>
          <p className="mb-4 text-sm text-muted-foreground">Create quick standalone reports without linking to a project</p>
          <div className="grid grid-cols-3 gap-4">
            <button 
              onClick={() => navigate("/notes", { state: { simpleMode: true } })}
              className="flex flex-col items-center gap-3 rounded-lg bg-card p-6 transition-colors hover:bg-secondary"
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                <FileText className="h-8 w-8 text-primary" />
              </div>
              <span className="text-sm font-medium text-foreground">Add Note</span>
            </button>
            <button 
              onClick={() => navigate("/capture-screen", { state: { simpleMode: true } })}
              className="flex flex-col items-center gap-3 rounded-lg bg-card p-6 transition-colors hover:bg-secondary"
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                <Camera className="h-8 w-8 text-primary" />
              </div>
              <span className="text-sm font-medium text-foreground">Add Photo</span>
            </button>
            <button 
              onClick={() => navigate("/checklist", { state: { simpleMode: true } })}
              className="flex flex-col items-center gap-3 rounded-lg bg-card p-6 transition-colors hover:bg-secondary"
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                <ListChecks className="h-8 w-8 text-primary" />
              </div>
              <span className="text-sm font-medium text-foreground">Checklist</span>
            </button>
          </div>
        </section>

        {/* History Section */}
        <section className="px-4 pt-8">
          <h3 className="mb-4 text-lg font-bold text-muted-foreground">
            History
          </h3>
          <div className="space-y-3">
            {reportHistory.map((report) => (
              <div
                key={report.id}
                className="flex items-center justify-between rounded-xl bg-card p-4"
              >
                <div className="flex-1">
                  <h4 className="text-base font-semibold text-foreground">
                    {report.title}
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    Sent: {report.date}
                  </p>
                </div>
                <div className="flex gap-4">
                  <button
                    onClick={() => handleShare(report.title)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <Share2 className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => handleDownload(report.title)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <Download className="h-5 w-5" />
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

export default SimpleMode;
