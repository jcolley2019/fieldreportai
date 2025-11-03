import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Check, Share2, Download } from "lucide-react";
import { toast } from "sonner";

const Confirmation = () => {
  const navigate = useNavigate();

  const cloudServices = [
    { id: "gdrive", name: "Google Drive", icon: "📄" },
    { id: "onedrive", name: "OneDrive", icon: "📁" },
    { id: "dropbox", name: "Dropbox", icon: "📦" },
  ];

  const reportHistory = [
    { id: "1", title: "Site Inspection - Alpha Project", date: "Oct 26, 2023" },
    { id: "2", title: "Quarterly Maintenance Review", date: "Oct 22, 2023" },
    { id: "3", title: "Final Walkthrough - Gamma Site", date: "Oct 19, 2023" },
  ];

  const handleViewReport = () => {
    navigate("/final-report");
  };

  const handleCreateNew = () => {
    navigate("/new-report");
  };

  const handleCloudShare = (service: string) => {
    toast.success(`Sending to ${service}...`);
  };

  const handleShare = (title: string) => {
    toast.success(`Sharing ${title}...`);
  };

  const handleDownload = (title: string) => {
    toast.success(`Downloading ${title}...`);
  };

  return (
    <div className="dark min-h-screen bg-background">
      {/* Header */}
      <div className="flex items-center p-4">
        <div className="h-12 w-12 shrink-0"></div>
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
        <h2 className="text-center text-[28px] font-bold leading-tight tracking-tight text-foreground">
          Report sent successfully!
        </h2>
      </div>

      {/* Action Buttons */}
      <div className="space-y-3 px-4 pb-2 pt-10">
        <Button
          onClick={handleViewReport}
          className="h-14 w-full bg-primary text-base font-bold text-primary-foreground hover:bg-primary/90"
        >
          View Report
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
          Also send to
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

      {/* History Section */}
      <div className="px-4 pt-8">
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
      </div>
    </div>
  );
};

export default Confirmation;
