import { useState, useEffect } from "react";
import { Rocket, X } from "lucide-react";

const LAUNCH_DATE = new Date("2026-03-01T00:00:00");

const BetaCountdownBanner = () => {
  const [timeLeft, setTimeLeft] = useState(getTimeLeft());
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(getTimeLeft());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  if (dismissed || timeLeft.total <= 0) return null;

  return (
    <div className="sticky top-0 relative bg-gradient-to-r from-primary/90 via-primary to-primary/90 text-primary-foreground py-4 px-4 text-center z-[60]">
      <div className="container mx-auto flex items-center justify-center gap-4 flex-wrap">
        <Rocket className="h-6 w-6 animate-pulse shrink-0" />
        <span className="text-base md:text-lg font-bold">
          You're part of our exclusive beta!
        </span>
        <span className="text-base md:text-lg opacity-90">We launch in</span>
        <div className="flex items-center gap-2">
          <TimeBlock value={timeLeft.days} label="d" />
          <span className="text-sm font-bold opacity-70">:</span>
          <TimeBlock value={timeLeft.hours} label="h" />
          <span className="text-sm font-bold opacity-70">:</span>
          <TimeBlock value={timeLeft.minutes} label="m" />
          <span className="text-sm font-bold opacity-70">:</span>
          <TimeBlock value={timeLeft.seconds} label="s" />
        </div>
        <span className="text-base md:text-lg font-bold inline-flex items-center gap-1.5">
          <Rocket className="h-5 w-5" /> March 1st, 2026
        </span>
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="absolute right-3 top-1/2 -translate-y-1/2 opacity-60 hover:opacity-100 transition-opacity"
        aria-label="Dismiss banner"
      >
        <X className="h-5 w-5" />
      </button>
    </div>
  );
};

function TimeBlock({ value, label }: { value: number; label: string }) {
  return (
    <span className="inline-flex items-center bg-black/20 rounded-md px-2 py-1 text-sm md:text-base font-mono font-bold tabular-nums min-w-[40px] justify-center">
      {String(value).padStart(2, "0")}
      <span className="text-xs opacity-70 ml-0.5">{label}</span>
    </span>
  );
}

function getTimeLeft() {
  const now = new Date();
  const total = LAUNCH_DATE.getTime() - now.getTime();
  if (total <= 0) return { total: 0, days: 0, hours: 0, minutes: 0, seconds: 0 };
  return {
    total,
    days: Math.floor(total / (1000 * 60 * 60 * 24)),
    hours: Math.floor((total / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((total / (1000 * 60)) % 60),
    seconds: Math.floor((total / 1000) % 60),
  };
}

export default BetaCountdownBanner;
