import { useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { BackButton } from "@/components/BackButton";
import { SettingsButton } from "@/components/SettingsButton";
import { Check, Share2, Download } from "lucide-react";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatDate } from '@/lib/dateFormat';

const Confirmation = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t, i18n } = useTranslation();
  const reportId = location.state?.reportId;
  const savedReportData = location.state?.reportData;

  const [recentReports, setRecentReports] = useState<any[]>([]);

  useEffect(() => {
    loadRecentReports();
  }, []);

  const loadRecentReports = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from('reports')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(5);

    if (!error && data) {
      setRecentReports(data);
    }
  };

  const cloudServices = [
    { id: "gdrive", name: "Google Drive", icon: "📄" },
    { id: "onedrive", name: "OneDrive", icon: "📁" },
    { id: "dropbox", name: "Dropbox", icon: "📦" },
  ];

  const handleViewReport = () => {
    if (reportId) {
      navigate("/final-report", { state: { reportId, reportData: savedReportData } });
    } else {
      navigate("/final-report");
    }
  };

  const handleCreateNew = () => {
    navigate("/new-project");
  };

  const handleCloudShare = (service: string) => {
    toast.success(`Sending to ${service}...`);
  };

  const handleShare = (reportId: string, title: string) => {
    toast.success(`Sharing ${title}...`);
    // TODO: Implement actual sharing functionality
  };

  const handleDownload = (reportId: string, title: string) => {
    toast.success(`Downloading ${title}...`);
    // TODO: Implement actual download functionality
  };

  return (
    <div className="dark min-h-screen bg-background">
      {/* Header */}
      <div className="flex items-center justify-between p-4">
        <BackButton />
        <h2 className="flex-1 text-center text-lg font-bold text-foreground">
          {t('confirmation.title')}
        </h2>
        <SettingsButton />
      </div>

      {/* Success Icon and Message */}
      <div className="flex flex-col items-center justify-center px-4 pt-12">
        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-primary/20">
          <Check className="h-12 w-12 text-primary" strokeWidth={3} />
        </div>
        <h2 className="text-center text-[28px] font-bold leading-tight tracking-tight text-foreground">
          {t('confirmation.reportCreated')}
        </h2>
      </div>

      {/* Action Buttons */}
      <div className="space-y-3 px-4 pb-2 pt-10">
        <Button
          onClick={handleViewReport}
          className="h-14 w-full bg-primary text-base font-bold text-primary-foreground hover:bg-primary/90"
        >
          {t('confirmation.viewReport')}
        </Button>
      </div>


      {/* History Section */}
      {recentReports.length > 0 && (
        <div className="px-4 pt-8 pb-8">
          <h3 className="mb-4 text-lg font-bold text-muted-foreground">
            {t('confirmation.recentReports')}
          </h3>
          <div className="space-y-3">
            {recentReports.map((report) => (
              <div
                key={report.id}
                className="flex items-center justify-between rounded-xl bg-card p-4"
              >
                <div className="flex-1">
                  <h4 className="text-base font-semibold text-foreground">
                    {report.project_name}
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    {report.customer_name} • {t('confirmation.job')} #{report.job_number}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t('confirmation.created')}: {formatDate(new Date(report.created_at))}
                  </p>
                </div>
                <div className="flex gap-4">
                  <button
                    onClick={() => handleShare(report.id, report.project_name)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <Share2 className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => handleDownload(report.id, report.project_name)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <Download className="h-5 w-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Confirmation;
