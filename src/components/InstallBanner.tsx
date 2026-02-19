import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { X, Smartphone } from "lucide-react";

const isMobileBrowser = (): boolean => {
  const ua = navigator.userAgent;
  return /Android|iPhone|iPad|iPod/i.test(ua);
};

const isInstalledPWA = (): boolean => {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as { standalone?: boolean }).standalone === true
  );
};

const DISMISSED_KEY = "install_banner_dismissed";

const InstallBanner = () => {
  const navigate = useNavigate();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem(DISMISSED_KEY);
    if (!dismissed && isMobileBrowser() && !isInstalledPWA()) {
      setVisible(true);
    }
  }, []);

  const handleDismiss = () => {
    localStorage.setItem(DISMISSED_KEY, "true");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="mb-4 flex items-center gap-3 rounded-2xl border border-primary/30 bg-primary/10 px-4 py-3">
      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-primary/20">
        <Smartphone className="h-5 w-5 text-primary" />
      </div>
      <button
        onClick={() => navigate("/install")}
        className="flex-1 text-left"
      >
        <p className="text-sm font-semibold text-foreground">Install on your phone</p>
        <p className="text-xs text-muted-foreground">Faster camera, offline support & no permission dialogs</p>
      </button>
      <button
        onClick={handleDismiss}
        className="flex-shrink-0 rounded-lg p-1.5 hover:bg-muted/40 transition-colors"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4 text-muted-foreground" />
      </button>
    </div>
  );
};

export default InstallBanner;
