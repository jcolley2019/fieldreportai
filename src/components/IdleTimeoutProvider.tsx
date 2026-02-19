import { useEffect, useState, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useIdleTimeout } from "@/hooks/useIdleTimeout";
import { IdleTimeoutWarning } from "./IdleTimeoutWarning";

// Routes where idle timeout should NOT be active
const PUBLIC_ROUTES = ["/", "/auth", "/pricing", "/landing"];

// Default values
const DEFAULT_IDLE_TIMEOUT = 15 * 60 * 1000; // 15 minutes
const WARNING_TIME = 60 * 1000; // 1 minute warning

export const IdleTimeoutProvider = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [idleTimeoutMs, setIdleTimeoutMs] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Check if current route is public
  const isPublicRoute = PUBLIC_ROUTES.some(
    (route) => location.pathname === route || location.pathname.startsWith("/auth")
  );

  // Fetch user's idle timeout preference
  const fetchIdleTimeoutPreference = useCallback(async (userId: string) => {
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("idle_timeout_minutes")
        .eq("id", userId)
        .single();

      if (profile) {
        const minutes = profile.idle_timeout_minutes;
        if (minutes === 0) {
          // Disabled
          setIdleTimeoutMs(0);
        } else if (minutes === null) {
          // Default (15 minutes)
          setIdleTimeoutMs(DEFAULT_IDLE_TIMEOUT);
        } else {
          // Custom value
          setIdleTimeoutMs(minutes * 60 * 1000);
        }
      } else {
        setIdleTimeoutMs(DEFAULT_IDLE_TIMEOUT);
      }
    } catch (error) {
      console.error("Error fetching idle timeout preference:", error);
      setIdleTimeoutMs(DEFAULT_IDLE_TIMEOUT);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // Check initial auth state
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setIsAuthenticated(!!session);
      
      if (session?.user) {
        await fetchIdleTimeoutPreference(session.user.id);
      } else {
        setIsLoading(false);
      }
    };
    checkAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      setIsAuthenticated(!!session);
      
      if (session?.user) {
        await fetchIdleTimeoutPreference(session.user.id);
      } else {
        setIdleTimeoutMs(null);
        setIsLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchIdleTimeoutPreference]);

  // Listen for profile changes (when user updates their timeout preference)
  useEffect(() => {
    if (!isAuthenticated) return;

    const channel = supabase
      .channel('profile-timeout-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
        },
        async (payload) => {
          const newMinutes = payload.new.idle_timeout_minutes;
          if (newMinutes === 0) {
            setIdleTimeoutMs(0);
          } else if (newMinutes === null) {
            setIdleTimeoutMs(DEFAULT_IDLE_TIMEOUT);
          } else {
            setIdleTimeoutMs(newMinutes * 60 * 1000);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAuthenticated]);

  // Only enable timeout for authenticated users on protected routes with non-zero timeout
  const shouldEnableTimeout = isAuthenticated && !isPublicRoute && !isLoading && idleTimeoutMs !== null && idleTimeoutMs > 0;

  const { showWarning, remainingTime, resetTimer, logout } = useIdleTimeout({
    timeout: idleTimeoutMs || DEFAULT_IDLE_TIMEOUT,
    warningTime: WARNING_TIME,
    enabled: shouldEnableTimeout,
  });

  return (
    <>
      {children}
      <IdleTimeoutWarning
        isOpen={showWarning}
        remainingTime={remainingTime}
        onStayLoggedIn={resetTimer}
        onLogout={logout}
      />
    </>
  );
};
