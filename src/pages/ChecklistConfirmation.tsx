import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { BackButton } from "@/components/BackButton";
import { Check, Share2, Download, CheckCircle2, FileText, Cloud, Printer, Link2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

interface ChecklistItem {
  text: string;
  priority: "high" | "medium" | "low";
  category: string;
  completed: boolean;
}

interface ChecklistData {
  title: string;
  items: ChecklistItem[];
}


const ChecklistConfirmation = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const checklist = location.state?.checklist as ChecklistData | undefined;

  const cloudServices = [
    { id: "pdf", name: "PDF", icon: "📄" },
    { id: "word", name: "Word Doc", icon: "📝" },
    { id: "copylink", name: "Copy Link", icon: "🔗" },
  ];

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "destructive";
      case "medium":
        return "default";
      case "low":
        return "secondary";
      default:
        return "default";
    }
  };

  const handleViewChecklist = () => {
    navigate("/checklist");
  };

  const handlePrintChecklist = () => {
    window.print();
  };

  const handleCreateNew = () => {
    navigate("/checklist");
  };

  const handleCloudShare = (service: string) => {
    toast.success(`Sending to ${service}...`);
  };

  return (
    <div className="dark min-h-screen bg-background pb-[400px]">{/* Added bottom padding for fixed action bar */}
      {/* Header */}
      <div className="flex items-center justify-between p-4">
        <BackButton />
        <h2 className="flex-1 text-center text-lg font-bold text-foreground">
          Confirmation
        </h2>
        <div className="w-[80px]"></div>
      </div>

      {/* Success Icon and Message */}
      <div className="flex flex-col items-center justify-center px-4 pt-12">
        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-primary/20">
          <Check className="h-12 w-12 text-primary" strokeWidth={3} />
        </div>
        <h2 className="text-center text-[28px] font-bold leading-tight tracking-tight text-foreground mb-2">
          Checklist created successfully!
        </h2>
        {checklist && (
          <p className="text-center text-muted-foreground">
            {checklist.items.length} tasks generated with AI
          </p>
        )}
      </div>

      {/* AI Generated Checklist Display */}
      {checklist && (
        <div className="px-4 py-6 max-h-96 overflow-y-auto">
          <h3 className="text-xl font-bold text-white mb-4">{checklist.title}</h3>
          <div className="space-y-3">
            {checklist.items.map((item, index) => (
              <div 
                key={index}
                className="flex items-start gap-3 p-4 rounded-lg bg-card border border-border hover:bg-secondary/50 transition-colors"
              >
                <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-foreground font-medium mb-2">{item.text}</p>
                  <div className="flex gap-2 flex-wrap">
                    <Badge variant={getPriorityColor(item.priority)} className="text-xs">
                      {item.priority}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {item.category}
                    </Badge>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="space-y-3 px-4 pb-2 pt-10">
        <Button
          onClick={handleViewChecklist}
          className="h-14 w-full bg-primary text-base font-bold text-primary-foreground hover:bg-primary/90"
        >
          View Checklist
        </Button>
        <Button
          onClick={handlePrintChecklist}
          className="h-14 w-full bg-primary text-base font-bold text-primary-foreground hover:bg-primary/90"
        >
          Print Checklist
        </Button>
        <Button
          onClick={handleCreateNew}
          variant="outline"
          className="h-14 w-full border-2 border-border bg-transparent text-base font-bold text-foreground hover:bg-secondary"
        >
          Create New
        </Button>
      </div>

      {/* Static Bottom Action Bar - Always Visible */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-border bg-background/95 backdrop-blur-sm p-4 z-20">
        <h3 className="mb-4 text-center text-lg font-semibold text-foreground">Save & Print</h3>
        <div className="mb-3 grid grid-cols-2 gap-3">
          <Button
            onClick={() => toast.success("Downloading PDF...")}
            className="bg-primary text-primary-foreground hover:bg-primary/90 py-6 text-base font-semibold transition-transform duration-200 hover:scale-105"
          >
            <Download className="mr-2 h-5 w-5" />
            Save as PDF
          </Button>
          <Button
            onClick={() => toast.success("Downloading Word document...")}
            className="bg-primary text-primary-foreground hover:bg-primary/90 py-6 text-base font-semibold transition-transform duration-200 hover:scale-105"
          >
            <FileText className="mr-2 h-5 w-5" />
            Save as Word
          </Button>
        </div>
        <div className="mb-3 grid grid-cols-2 gap-3">
          <Button
            onClick={() => toast.success("Saving to cloud...")}
            className="bg-primary text-primary-foreground hover:bg-primary/90 py-6 text-base font-semibold transition-transform duration-200 hover:scale-105"
          >
            <Cloud className="mr-2 h-5 w-5" />
            Save to Cloud
          </Button>
          <div className="grid grid-cols-[1fr_auto] gap-3">
            <Button
              onClick={handlePrintChecklist}
              className="bg-primary text-primary-foreground hover:bg-primary/90 py-6 text-base font-semibold transition-transform duration-200 hover:scale-105"
            >
              <Printer className="mr-2 h-5 w-5" />
              Print
            </Button>
            <Button
              onClick={() => {
                navigator.clipboard.writeText(window.location.href);
                toast.success("Link copied to clipboard!");
              }}
              className="bg-primary text-primary-foreground hover:bg-primary/90 w-14 items-center justify-center py-6 transition-transform duration-200 hover:scale-105"
              title="Copy Link"
            >
              <Link2 className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>

    </div>
  );
};

export default ChecklistConfirmation;
