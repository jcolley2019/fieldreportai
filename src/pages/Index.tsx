import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { User } from "@supabase/supabase-js";

const Index = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  if (loading) {
    return (
      <div className="dark min-h-screen">
        <div className="flex min-h-screen items-center justify-center bg-background">
          <div className="text-foreground">Loading...</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="dark min-h-screen">
      <div className="flex min-h-screen w-full flex-col items-center justify-center bg-background p-4">
        <div className="w-full max-w-2xl">
          <div className="rounded-lg border border-input bg-card p-8 text-center">
            <h1 className="pb-4 text-3xl font-bold text-foreground">
              Welcome to Field Reporting
            </h1>
            <p className="pb-6 text-muted-foreground">
              You're logged in as: {user.email}
            </p>
            <Button
              onClick={handleLogout}
              variant="outline"
              className="h-10"
            >
              Log Out
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
