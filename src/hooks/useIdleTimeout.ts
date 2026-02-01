import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

interface UseIdleTimeoutOptions {
  /** Idle timeout in milliseconds (default: 15 minutes) */
  timeout?: number;
  /** Time before timeout to show warning in milliseconds (default: 1 minute) */
  warningTime?: number;
  /** Whether the timeout is enabled (default: true) */
  enabled?: boolean;
}

interface UseIdleTimeoutReturn {
  /** Whether the warning modal should be shown */
  showWarning: boolean;
  /** Remaining time in seconds before logout */
  remainingTime: number;
  /** Reset the idle timer (e.g., when user clicks "Stay logged in") */
  resetTimer: () => void;
  /** Manually trigger logout */
  logout: () => Promise<void>;
}

const ACTIVITY_EVENTS = [
  "mousedown",
  "mousemove",
  "keydown",
  "scroll",
  "touchstart",
  "click",
  "wheel",
] as const;

export const useIdleTimeout = ({
  timeout = 15 * 60 * 1000, // 15 minutes
  warningTime = 60 * 1000, // 1 minute warning
  enabled = true,
}: UseIdleTimeoutOptions = {}): UseIdleTimeoutReturn => {
  const navigate = useNavigate();
  const [showWarning, setShowWarning] = useState(false);
  const [remainingTime, setRemainingTime] = useState(0);
  
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const warningTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityRef = useRef<number>(Date.now());

  const logout = useCallback(async () => {
    // Clear all timers
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
    
    setShowWarning(false);
    
    try {
      await supabase.auth.signOut();
      navigate("/auth", { replace: true });
    } catch (error) {
      console.error("Error during logout:", error);
      // Still navigate to auth page even if signOut fails
      navigate("/auth", { replace: true });
    }
  }, [navigate]);

  const resetTimer = useCallback(() => {
    lastActivityRef.current = Date.now();
    setShowWarning(false);
    setRemainingTime(0);
    
    // Clear existing timers
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);

    if (!enabled) return;

    // Set warning timeout
    warningTimeoutRef.current = setTimeout(() => {
      setShowWarning(true);
      setRemainingTime(Math.ceil(warningTime / 1000));
      
      // Start countdown
      countdownRef.current = setInterval(() => {
        setRemainingTime((prev) => {
          if (prev <= 1) {
            if (countdownRef.current) clearInterval(countdownRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }, timeout - warningTime);

    // Set logout timeout
    timeoutRef.current = setTimeout(() => {
      logout();
    }, timeout);
  }, [enabled, timeout, warningTime, logout]);

  // Handle user activity
  useEffect(() => {
    if (!enabled) return;

    const handleActivity = () => {
      // Only reset if warning is not showing (to prevent accidental dismissal)
      if (!showWarning) {
        resetTimer();
      }
    };

    // Add event listeners
    ACTIVITY_EVENTS.forEach((event) => {
      document.addEventListener(event, handleActivity, { passive: true });
    });

    // Initial timer setup
    resetTimer();

    return () => {
      // Clean up event listeners
      ACTIVITY_EVENTS.forEach((event) => {
        document.removeEventListener(event, handleActivity);
      });
      
      // Clear all timers
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [enabled, resetTimer, showWarning]);

  return {
    showWarning,
    remainingTime,
    resetTimer,
    logout,
  };
};
