import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useIdleTimeout } from "@/hooks/useIdleTimeout";
import { IdleTimeoutWarning } from "./IdleTimeoutWarning";

// Routes where idle timeout should NOT be active
const PUBLIC_ROUTES = ["/", "/auth", "/pricing", "/landing"];

// 15 minutes idle timeout, 1 minute warning
const IDLE_TIMEOUT = 15 * 60 * 1000;
const WARNING_TIME = 60 * 1000;

export const IdleTimeoutProvider = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  
  // Check if current route is public
  const isPublicRoute = PUBLIC_ROUTES.some(
    (route) => location.pathname === route || location.pathname.startsWith("/auth")
  );

  // Only enable timeout for authenticated users on protected routes
  const shouldEnableTimeout = isAuthenticated && !isPublicRoute;

  useEffect(() => {
    // Check initial auth state
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setIsAuthenticated(!!session);
    };
    checkAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setIsAuthenticated(!!session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const { showWarning, remainingTime, resetTimer, logout } = useIdleTimeout({
    timeout: IDLE_TIMEOUT,
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
