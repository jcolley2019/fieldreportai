import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { BackButton } from "@/components/BackButton";
import { GlassNavbar, NavbarLeft, NavbarCenter, NavbarTitle } from "@/components/GlassNavbar";
import { Share, MoreHorizontal, Plus, Download, CheckCircle2, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";

type Platform = "ios" | "android" | "desktop" | "unknown";

const detectPlatform = (): Platform => {
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) return "ios";
  if (/Android/.test(ua)) return "android";
  if (/Macintosh|Windows|Linux/.test(ua)) return "desktop";
  return "unknown";
};

const isInstalled = (): boolean => {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as { standalone?: boolean }).standalone === true
  );
};

const Install = () => {
  const navigate = useNavigate();
  const [platform, setPlatform] = useState<Platform>("unknown");
  const [installed, setInstalled] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<Event | null>(null);

  useEffect(() => {
    setPlatform(detectPlatform());
    setInstalled(isInstalled());

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleAndroidInstall = async () => {
    if (!deferredPrompt) return;
    (deferredPrompt as unknown as { prompt: () => void }).prompt();
    setDeferredPrompt(null);
  };

  if (installed) {
    return (
      <div className="dark min-h-screen bg-background">
        <GlassNavbar fixed={false}>
          <NavbarLeft><BackButton /></NavbarLeft>
          <NavbarCenter><NavbarTitle>Install App</NavbarTitle></NavbarCenter>
        </GlassNavbar>
        <main className="flex flex-col items-center justify-center min-h-[80vh] p-8 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-primary/20 mb-6">
            <CheckCircle2 className="h-10 w-10 text-primary" />
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-2">Already Installed!</h2>
          <p className="text-muted-foreground mb-8">
            Field Report AI is running as an installed app. Camera permissions will be remembered between sessions.
          </p>
          <Button onClick={() => navigate("/dashboard")} className="bg-primary text-primary-foreground">
            Go to Dashboard
          </Button>
        </main>
      </div>
    );
  }

  return (
    <div className="dark min-h-screen bg-background">
      <GlassNavbar fixed={false}>
        <NavbarLeft><BackButton /></NavbarLeft>
        <NavbarCenter><NavbarTitle>Install App</NavbarTitle></NavbarCenter>
      </GlassNavbar>

      <main className="p-5 max-w-lg mx-auto animate-fade-in">
        {/* Hero */}
        <div className="flex flex-col items-center text-center py-8">
          <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-primary/20 mb-5">
            <Smartphone className="h-10 w-10 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">Add to Home Screen</h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Install Field Report AI on your phone for the best experience — instant camera access, offline support, and no browser chrome.
          </p>
        </div>

        {/* Benefits */}
        <div className="glass-card p-5 mb-6 space-y-3">
          {[
            { emoji: "📷", text: "Camera permission remembered — no more permission dialogs" },
            { emoji: "⚡", text: "Launches instantly from your home screen" },
            { emoji: "📶", text: "Works offline — capture photos even without signal" },
            { emoji: "🖥️", text: "Full-screen, no browser address bar" },
          ].map((item) => (
            <div key={item.emoji} className="flex items-start gap-3">
              <span className="text-xl leading-none mt-0.5">{item.emoji}</span>
              <p className="text-sm text-foreground">{item.text}</p>
            </div>
          ))}
        </div>

        {/* iOS Instructions */}
        {(platform === "ios" || platform === "unknown") && (
          <div className="mb-6">
            <h2 className="text-base font-semibold text-foreground mb-4 flex items-center gap-2">
              <span>🍎</span> iPhone / iPad
            </h2>
            <div className="space-y-3">
              {[
                {
                  step: 1,
                  icon: <Share className="h-5 w-5 text-primary flex-shrink-0" />,
                  title: 'Tap the Share button',
                  desc: 'The box-with-arrow icon at the bottom of Safari',
                },
                {
                  step: 2,
                  icon: <Plus className="h-5 w-5 text-primary flex-shrink-0" />,
                  title: '"Add to Home Screen"',
                  desc: 'Scroll down in the share sheet and tap it',
                },
                {
                  step: 3,
                  icon: <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />,
                  title: 'Tap "Add"',
                  desc: 'The app appears on your home screen like a native app',
                },
              ].map((item) => (
                <div key={item.step} className="flex items-start gap-4 glass-card p-4">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary flex-shrink-0 mt-0.5">
                    {item.step}
                  </div>
                  <div className="flex items-start gap-3 flex-1">
                    {item.icon}
                    <div>
                      <p className="text-sm font-medium text-foreground">{item.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground text-center mt-3">
              ⚠️ Must use <strong>Safari</strong> — Chrome on iOS does not support this
            </p>
          </div>
        )}

        {/* Android Instructions */}
        {(platform === "android" || platform === "unknown") && (
          <div className="mb-6">
            <h2 className="text-base font-semibold text-foreground mb-4 flex items-center gap-2">
              <span>🤖</span> Android
            </h2>
            {deferredPrompt ? (
              <Button
                onClick={handleAndroidInstall}
                className="w-full bg-primary text-primary-foreground h-12 text-base font-semibold gap-2"
              >
                <Download className="h-5 w-5" />
                Install Field Report AI
              </Button>
            ) : (
              <div className="space-y-3">
                {[
                  {
                    step: 1,
                    icon: <MoreHorizontal className="h-5 w-5 text-primary flex-shrink-0" />,
                    title: 'Tap the menu (⋮)',
                    desc: 'Three-dot menu in the top-right of Chrome',
                  },
                  {
                    step: 2,
                    icon: <Plus className="h-5 w-5 text-primary flex-shrink-0" />,
                    title: '"Add to Home screen"',
                    desc: 'Or "Install app" if Chrome detects it automatically',
                  },
                  {
                    step: 3,
                    icon: <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />,
                    title: 'Tap "Install"',
                    desc: 'The app icon appears on your home screen',
                  },
                ].map((item) => (
                  <div key={item.step} className="flex items-start gap-4 glass-card p-4">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary flex-shrink-0 mt-0.5">
                      {item.step}
                    </div>
                    <div className="flex items-start gap-3 flex-1">
                      {item.icon}
                      <div>
                        <p className="text-sm font-medium text-foreground">{item.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="pb-8" />
      </main>
    </div>
  );
};

export default Install;
