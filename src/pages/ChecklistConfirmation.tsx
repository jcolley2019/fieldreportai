import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Check, Share2, Download, CheckCircle2, ArrowLeft } from "lucide-react";
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
    <div className="dark min-h-screen bg-background">
      {/* Header */}
      <div className="flex items-center p-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(-1)}
          className="h-12 w-12 shrink-0"
        >
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </Button>
        <h2 className="flex-1 text-center text-lg font-bold text-foreground">
          Confirmation
        </h2>
        <div className="h-12 w-12 shrink-0"></div>
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

      {/* Cloud Storage Options */}
      <div className="px-4 pt-8">
        <h3 className="mb-4 text-base font-medium text-muted-foreground">
          Save as:
        </h3>
        <div className="grid grid-cols-3 gap-4">
          {cloudServices.map((service) => (
            <button
              key={service.id}
              onClick={() => handleCloudShare(service.name)}
              className="flex flex-col items-center gap-3 rounded-xl bg-card p-4 transition-colors hover:bg-secondary"
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-muted text-3xl">
                {service.icon}
              </div>
              <span className="text-sm font-medium text-foreground">
                {service.name}
              </span>
            </button>
          ))}
        </div>
      </div>

    </div>
  );
};

export default ChecklistConfirmation;
