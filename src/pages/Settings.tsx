import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  ArrowLeft,
  User,
  ChevronRight,
  CloudOff,
  Mic,
  Bell,
  Moon,
  HelpCircle,
  MessageSquare,
  Info,
  Shield,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const Settings = () => {
  const navigate = useNavigate();
  const [offlineMode, setOfflineMode] = useState(true);
  const [autoRecord, setAutoRecord] = useState(false);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Logged out successfully");
    navigate("/auth");
  };

  const handleManageCloud = () => {
    toast.success("Opening cloud connections...");
  };

  return (
    <div className="dark min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 flex items-center justify-between bg-background p-4 pb-2">
        <button
          onClick={() => navigate(-1)}
          className="flex h-12 w-12 shrink-0 items-center justify-center text-foreground"
        >
          <ArrowLeft className="h-6 w-6" />
        </button>
        <h1 className="flex-1 text-center text-lg font-bold text-foreground">
          Settings
        </h1>
        <div className="h-12 w-12 shrink-0"></div>
      </header>

      <main className="flex-grow pb-8">
        {/* User Profile Section */}
        <div className="flex min-h-[72px] items-center justify-between gap-4 bg-background px-4 py-4">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/20">
              <User className="h-8 w-8 text-primary" />
            </div>
            <div className="flex flex-col justify-center">
              <p className="text-base font-bold leading-tight text-foreground">
                David Miller
              </p>
              <p className="text-sm font-normal leading-normal text-muted-foreground">
                david.miller@fieldwork.com
              </p>
            </div>
          </div>
          <button className="text-muted-foreground">
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        {/* Cloud Connections Section */}
        <div className="bg-background px-4 py-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-1">
              <h2 className="text-lg font-bold text-foreground">
                Manage Cloud Connections
              </h2>
              <p className="text-sm text-muted-foreground">
                Link or unlink your cloud storage accounts to sync your data
                automatically.
              </p>
            </div>
            <Button
              onClick={handleManageCloud}
              className="shrink-0 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Manage
            </Button>
          </div>
        </div>

        {/* DATA & CAPTURE Section */}
        <div className="px-4 pt-4">
          <h3 className="pb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Data & Capture
          </h3>

          {/* Offline Mode Toggle */}
          <div className="flex items-center justify-between border-b border-border py-4">
            <div className="flex items-center gap-4">
              <CloudOff className="h-5 w-5 text-foreground" />
              <span className="text-base font-medium text-foreground">
                Offline Mode
              </span>
            </div>
            <Switch checked={offlineMode} onCheckedChange={setOfflineMode} />
          </div>

          {/* Auto Record Toggle */}
          <div className="flex flex-col gap-2 border-b border-border py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Mic className="h-5 w-5 text-foreground" />
                <span className="text-base font-medium text-foreground">
                  Auto Record
                </span>
              </div>
              <Switch checked={autoRecord} onCheckedChange={setAutoRecord} />
            </div>
            <p className="pl-9 text-sm text-muted-foreground">
              Automatically record audio when taking photos or videos.
            </p>
          </div>
        </div>

        {/* GENERAL Section */}
        <div className="px-4 pt-6">
          <h3 className="pb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            General
          </h3>

          {/* Notifications */}
          <button className="flex w-full items-center justify-between border-b border-border py-4">
            <div className="flex items-center gap-4">
              <Bell className="h-5 w-5 text-foreground" />
              <span className="text-base font-medium text-foreground">
                Notifications
              </span>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </button>

          {/* Appearance */}
          <button className="flex w-full items-center justify-between border-b border-border py-4">
            <div className="flex items-center gap-4">
              <Moon className="h-5 w-5 text-foreground" />
              <span className="text-base font-medium text-foreground">
                Appearance
              </span>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        {/* SUPPORT & FEEDBACK Section */}
        <div className="px-4 pt-6">
          <h3 className="pb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Support & Feedback
          </h3>

          {/* Help Center */}
          <button className="flex w-full items-center justify-between border-b border-border py-4">
            <div className="flex items-center gap-4">
              <HelpCircle className="h-5 w-5 text-foreground" />
              <span className="text-base font-medium text-foreground">
                Help Center
              </span>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </button>

          {/* Send Feedback */}
          <button className="flex w-full items-center justify-between border-b border-border py-4">
            <div className="flex items-center gap-4">
              <MessageSquare className="h-5 w-5 text-foreground" />
              <span className="text-base font-medium text-foreground">
                Send Feedback
              </span>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        {/* ABOUT Section */}
        <div className="px-4 pt-6">
          <h3 className="pb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            About
          </h3>

          {/* About Fieldwork */}
          <div className="flex items-center justify-between border-b border-border py-4">
            <div className="flex items-center gap-4">
              <Info className="h-5 w-5 text-foreground" />
              <span className="text-base font-medium text-foreground">
                About Fieldwork
              </span>
            </div>
            <span className="text-sm text-muted-foreground">v2.1.0</span>
          </div>

          {/* Privacy Policy */}
          <button className="flex w-full items-center justify-between border-b border-border py-4">
            <div className="flex items-center gap-4">
              <Shield className="h-5 w-5 text-foreground" />
              <span className="text-base font-medium text-foreground">
                Privacy Policy
              </span>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        {/* Log Out Button */}
        <div className="px-4 pt-8">
          <button
            onClick={handleLogout}
            className="w-full py-3 text-center text-base font-medium text-destructive hover:underline"
          >
            Log Out
          </button>
        </div>
      </main>
    </div>
  );
};

export default Settings;
