import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { FileText, Camera, ListChecks, ArrowLeft } from "lucide-react";

const SimpleMode = () => {
  const navigate = useNavigate();

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
      </main>
    </div>
  );
};

export default SimpleMode;
