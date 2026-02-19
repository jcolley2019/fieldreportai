import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const location = useLocation();

  useEffect(() => {
    let isMounted = true;
    let resolved = false;

    const resolve = (authenticated: boolean) => {
      if (!isMounted || resolved) return;
      resolved = true;
      setAuthenticated(authenticated);
      setLoading(false);
    };

    // Fast path: read session from localStorage immediately
    supabase.auth.getSession().then(({ data: { session } }) => {
      resolve(!!session);
    });

    // Also listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) return;
      if (resolved) {
        setAuthenticated(!!session);
      } else {
        resolve(!!session);
      }
    });

    // Safety net: 5s timeout
    const safetyTimer = setTimeout(() => {
      if (isMounted && !resolved) resolve(false);
    }, 5000);

    return () => {
      isMounted = false;
      clearTimeout(safetyTimer);
      subscription.unsubscribe();
    };
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!authenticated) {
    return <Navigate to={`/auth?redirect=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
