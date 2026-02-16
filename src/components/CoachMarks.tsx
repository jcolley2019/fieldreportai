import { useState, useEffect } from "react";
import { X } from "lucide-react";

interface CoachStep {
  targetSelector: string;
  title: string;
  description: string;
  position?: "top" | "bottom" | "left" | "right";
}

interface CoachMarksProps {
  steps: CoachStep[];
  storageKey: string;
}

const CoachMarks = ({ steps, storageKey }: CoachMarksProps) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [visible, setVisible] = useState(false);
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({});
  const [arrowStyle, setArrowStyle] = useState<React.CSSProperties>({});
  const [arrowDirection, setArrowDirection] = useState<"top" | "bottom">("top");

  useEffect(() => {
    const dismissed = localStorage.getItem(storageKey);
    if (dismissed) return;

    // Small delay to let the page render
    const timer = setTimeout(() => setVisible(true), 800);
    return () => clearTimeout(timer);
  }, [storageKey]);

  useEffect(() => {
    if (!visible) return;
    positionTooltip();

    const handleResize = () => positionTooltip();
    window.addEventListener("resize", handleResize);
    window.addEventListener("scroll", handleResize, true);
    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("scroll", handleResize, true);
    };
  }, [visible, currentStep]);

  const positionTooltip = () => {
    const step = steps[currentStep];
    if (!step) return;

    const el = document.querySelector(step.targetSelector);
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const tooltipWidth = 280;
    const tooltipHeight = 120;
    const gap = 12;

    // Determine if tooltip goes above or below
    const spaceBelow = window.innerHeight - rect.bottom;
    const placeBelow = spaceBelow > tooltipHeight + gap + 20;

    let top: number;
    if (placeBelow) {
      top = rect.bottom + gap;
      setArrowDirection("top");
    } else {
      top = rect.top - tooltipHeight - gap;
      setArrowDirection("bottom");
    }

    // Center horizontally on target, clamp to viewport
    let left = rect.left + rect.width / 2 - tooltipWidth / 2;
    left = Math.max(12, Math.min(left, window.innerWidth - tooltipWidth - 12));

    setTooltipStyle({
      position: "fixed",
      top: `${top}px`,
      left: `${left}px`,
      width: `${tooltipWidth}px`,
    });

    // Arrow pointing at target center
    const arrowLeft = rect.left + rect.width / 2 - left - 6;
    setArrowStyle({
      position: "absolute",
      left: `${Math.max(12, Math.min(arrowLeft, tooltipWidth - 24))}px`,
      ...(placeBelow
        ? { top: "-6px" }
        : { bottom: "-6px" }),
    });

    // Add highlight ring to target element
    el.classList.add("coach-mark-highlight");
    return () => el.classList.remove("coach-mark-highlight");
  };

  const handleNext = () => {
    // Remove highlight from current
    const currentEl = document.querySelector(steps[currentStep]?.targetSelector);
    currentEl?.classList.remove("coach-mark-highlight");

    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      dismiss();
    }
  };

  const dismiss = () => {
    const currentEl = document.querySelector(steps[currentStep]?.targetSelector);
    currentEl?.classList.remove("coach-mark-highlight");
    localStorage.setItem(storageKey, "true");
    setVisible(false);
  };

  if (!visible || !steps[currentStep]) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[9998] bg-black/40 transition-opacity duration-300"
        onClick={dismiss}
      />

      {/* Tooltip */}
      <div
        style={tooltipStyle}
        className="fixed z-[9999] animate-fade-in rounded-xl border border-primary/30 bg-card p-4 shadow-2xl shadow-primary/20"
      >
        {/* Arrow */}
        <div
          style={arrowStyle}
          className={`absolute h-3 w-3 rotate-45 border-primary/30 bg-card ${
            arrowDirection === "top"
              ? "border-l border-t"
              : "border-b border-r"
          }`}
        />

        {/* Close button */}
        <button
          onClick={dismiss}
          className="absolute right-2 top-2 rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>

        {/* Content */}
        <h4 className="text-sm font-semibold text-foreground pr-6">
          {steps[currentStep].title}
        </h4>
        <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
          {steps[currentStep].description}
        </p>

        {/* Footer */}
        <div className="mt-3 flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground">
            {currentStep + 1} / {steps.length}
          </span>
          <button
            onClick={handleNext}
            className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            {currentStep < steps.length - 1 ? "Next" : "Got it!"}
          </button>
        </div>
      </div>
    </>
  );
};

export default CoachMarks;
