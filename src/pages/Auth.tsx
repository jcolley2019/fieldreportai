import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Eye, EyeOff, Fingerprint, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import { z } from "zod";

const AUTH_TIMEOUT_MS = 30_000; // 30 seconds - mobile networks need more time

const authSchema = z.object({
  email: z.string().trim().email({ message: "Invalid email address" }).max(255),
  password: z
    .string()
    .min(8, { message: "Password must be at least 8 characters" })
    .max(100, { message: "Password must be less than 100 characters" }),
});

const Auth = () => {
  const { t } = useTranslation();
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectUrl = searchParams.get("redirect");
  const pendingPlan = searchParams.get("plan");
  const pendingBilling = searchParams.get("billing");
  const sessionId = searchParams.get("session_id");
  const mode = searchParams.get("mode");
  const startTrial = searchParams.get("startTrial");
  const isMountedRef = useRef(true);
  const loadingTimeoutRef = useRef<number | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (loadingTimeoutRef.current) {
        window.clearTimeout(loadingTimeoutRef.current);
      }
    };
  }, []);

  // Set signup mode if coming from guest checkout or trial start
  useEffect(() => {
    if (mode === 'signup' || startTrial === 'true') {
      setIsLogin(false);
    }
  }, [mode, startTrial]);

  // Safety timeout for loading state
  useEffect(() => {
    if (!loading) {
      if (loadingTimeoutRef.current) {
        window.clearTimeout(loadingTimeoutRef.current);
        loadingTimeoutRef.current = null;
      }
      return;
    }

    loadingTimeoutRef.current = window.setTimeout(() => {
      if (isMountedRef.current) {
        setLoading(false);
        toast({
          title: "Request timed out",
          description: "Please try again.",
          variant: "destructive",
        });
      }
    }, AUTH_TIMEOUT_MS + 2000);

    return () => {
      if (loadingTimeoutRef.current) {
        window.clearTimeout(loadingTimeoutRef.current);
      }
    };
  }, [loading]);

  // Check if already logged in on mount
  useEffect(() => {
    let cancelled = false;
    
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session && !cancelled) {
          navigate("/dashboard");
        }
      } catch (error) {
        console.error("Session check error:", error);
      }
    };
    
    checkSession();
    
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  const ensureProfileRow = async (userId: string) => {
    try {
      const { error } = await supabase
        .from("profiles")
        .upsert({ id: userId }, { onConflict: "id" });

      if (error) {
        console.error("ensureProfileRow error:", error);
      }
    } catch (err) {
      console.error("ensureProfileRow error:", err);
    }
  };

  const navigateAfterAuth = async (userId: string) => {
    await ensureProfileRow(userId);

    // Fire-and-forget side-effects
    if (sessionId) {
      supabase.functions
        .invoke("link-subscription", { body: { sessionId } })
        .catch((err) => console.error("Subscription link error:", err));
    }

    if (startTrial === "true") {
      activateTrialNonBlocking(userId);
    }

    if (redirectUrl) {
      const fullRedirect =
        pendingPlan && pendingBilling
          ? `${redirectUrl}?plan=${pendingPlan}&billing=${pendingBilling}`
          : redirectUrl;
      navigate(fullRedirect);
    } else {
      const destination = await getNavigationDestination(userId);
      navigate(destination);
    }
  };

  const activateTrialNonBlocking = async (userId: string) => {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('trial_start_date')
        .eq('id', userId)
        .maybeSingle();

      if (profile?.trial_start_date) return;

      await supabase
        .from('profiles')
        .update({ trial_start_date: new Date().toISOString() })
        .eq('id', userId);

      toast({
        title: "Trial Activated!",
        description: "Enjoy 14 days of Pro features — no payment required",
      });
    } catch (error) {
      console.error('Trial activation error:', error);
    }
  };

  const getNavigationDestination = async (userId: string): Promise<string> => {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('first_name, last_name, company_name')
        .eq('id', userId)
        .maybeSingle();

      const isComplete = profile?.first_name && profile?.last_name && profile?.company_name;
      return isComplete ? "/dashboard" : "/onboarding";
    } catch (error) {
      console.error('Profile check error:', error);
      return "/onboarding";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (loading) return;
    setLoading(true);

    try {
      // Validate input
      const validatedData = isLogin
        ? { email: z.string().trim().email().max(255).parse(email), password }
        : authSchema.parse({ email, password });

      if (isLogin) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: validatedData.email,
          password: validatedData.password,
        });

        if (error) {
          if (error.message.includes("Invalid login credentials")) {
            setIsLogin(false);
            toast({
              title: t("auth.errors.noAccountFound") || "No account found",
              description:
                t("auth.errors.switchedToSignup") ||
                "We switched to Sign Up mode. Click the button to create your account.",
            });
            return;
          }

          toast({
            title: "Login Error",
            description: error.message,
            variant: "destructive",
          });
          return;
        }

        toast({
          title: "Success",
          description: "Logging you in...",
        });

        await navigateAfterAuth(data.user.id);
        return;
      }

      // SIGNUP FLOW
      const { data, error } = await supabase.auth.signUp({
        email: validatedData.email,
        password: validatedData.password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
        },
      });

      if (error) {
        const msg = (error.message || "").toLowerCase();
        if (msg.includes("already registered") || msg.includes("already exists")) {
          setIsLogin(true);
          toast({
            title: t("auth.errors.accountExists"),
            description: t("auth.errors.emailRegistered"),
            variant: "destructive",
          });
          return;
        }

        toast({
          title: "Signup Error",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      // Capture lead (non-blocking)
      supabase.functions
        .invoke("capture-lead", {
          body: { email: validatedData.email, source: "trial_signup", sequence: "trial" },
        })
        .catch((err) => console.error("Lead capture failed:", err));

      // Zapier webhook (non-blocking)
      fetch("https://hooks.zapier.com/hooks/catch/25475428/uzqf7vv/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        mode: "no-cors",
        body: JSON.stringify({
          email: validatedData.email,
          source: "trial_signup",
          type: "user_signup",
          timestamp: new Date().toISOString(),
          plan: "trial",
          sequence: "trial",
        }),
      }).catch((err) => console.error("Zapier webhook failed:", err));

      const needsEmailConfirmation = data?.user && !data?.session;
      if (needsEmailConfirmation) {
        toast({
          title: "Check your email",
          description: "Please check your email to confirm your account before logging in.",
        });
        setIsLogin(true);
        return;
      }

      const userId = data?.user?.id;
      if (!userId) {
        toast({
          title: "Signup Error",
          description: "Account created, but could not finish setup. Please log in.",
          variant: "destructive",
        });
        setIsLogin(true);
        return;
      }

      toast({
        title: "Account Created!",
        description: "Setting up your account...",
      });

      await navigateAfterAuth(userId);
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({
          title: t("auth.errors.validationError"),
          description: error.errors[0].message,
          variant: "destructive",
        });
        return;
      }

      console.error("Auth error:", error);
      toast({
        title: "Error",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      if (isMountedRef.current) setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/dashboard`,
          skipBrowserRedirect: true,
        },
      });

      if (error) {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      const url = data?.url;
      if (!url) {
        toast({
          title: "Error",
          description: "Unable to start Google sign-in. Please try again.",
          variant: "destructive",
        });
        return;
      }

      try {
        if (window.top) {
          (window.top as Window).location.href = url;
        } else {
          window.location.href = url;
        }
      } catch {
        window.location.href = url;
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to sign in with Google",
        variant: "destructive",
      });
    }
  };

  const handleBiometricLogin = () => {
    toast({
      title: t('auth.success.biometricSoon').split('.')[0],
      description: t('auth.success.biometricSoon'),
    });
  };

  const handlePasswordReset = async () => {
    if (!email) {
      toast({
        title: t('auth.errors.validationError'),
        description: t('auth.errors.emailRequired'),
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth?reset=true`,
      });

      if (error) {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      toast({
        title: t('auth.success.resetSent').split('.')[0],
        description: t('auth.success.resetSent'),
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to send reset email",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      {/* Header */}
      <header className="p-4 flex items-center justify-center">
        <div className="flex items-center gap-2">
          <FileText className="w-8 h-8 text-white" />
          <span className="text-xl font-bold text-white">Field Report AI</span>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-700/50">
            <h1 className="text-2xl font-bold text-center text-white mb-6">
              {isLogin ? t('auth.logIn') : t('auth.signUp')}
            </h1>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-gray-300">
                  {t('auth.emailAddress')}
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder={t('auth.emailPlaceholder')}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-gray-700/50 border-gray-600 text-white placeholder:text-gray-400"
                  required
                  disabled={loading}
                  autoComplete="email"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-gray-300">
                  {t('auth.password')}
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder={t('auth.passwordPlaceholder')}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="bg-gray-700/50 border-gray-600 text-white placeholder:text-gray-400 pr-10"
                    required
                    disabled={loading}
                    autoComplete={isLogin ? "current-password" : "new-password"}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {isLogin && (
                <button
                  type="button"
                  onClick={handlePasswordReset}
                  className="text-sm text-primary hover:underline"
                  disabled={loading}
                >
                  {t('auth.forgotPassword')}
                </button>
              )}

              <Button
                type="submit"
                className="w-full bg-primary hover:bg-primary/90"
                disabled={loading}
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    {isLogin ? "Signing in..." : "Creating account..."}
                  </span>
                ) : (
                  isLogin ? t('auth.logIn') : t('auth.signUp')
                )}
              </Button>
            </form>

            <div className="mt-4 space-y-3">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-gray-600" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-gray-800 px-2 text-gray-400">{t('auth.orContinueWith')}</span>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                className="w-full border-gray-600 text-white hover:bg-gray-700"
                onClick={handleGoogleLogin}
                disabled={loading}
              >
                <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                {t('auth.continueWithGoogle')}
              </Button>

              <Button
                type="button"
                variant="outline"
                className="w-full border-gray-600 text-white hover:bg-gray-700"
                onClick={handleBiometricLogin}
                disabled={loading}
              >
                <Fingerprint className="w-4 h-4 mr-2" />
                {t('auth.loginWithBiometrics')}
              </Button>
            </div>

            <p className="mt-6 text-center text-sm text-gray-400">
              {isLogin ? t('auth.dontHaveAccount') : t('auth.alreadyHaveAccount')}
              <button
                type="button"
                onClick={() => setIsLogin(!isLogin)}
                className="text-primary hover:underline font-medium"
                disabled={loading}
              >
                {isLogin ? t('auth.signUp') : t('auth.logIn')}
              </button>
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="p-4 text-center text-gray-500 text-sm">
        © 2025 Field Report AI. All rights reserved.
      </footer>
    </div>
  );
};

export default Auth;
