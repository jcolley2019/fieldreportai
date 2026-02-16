import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Eye, EyeOff, Fingerprint, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import { z } from "zod";


const authSchema = z.object({
  email: z.string().trim().email({ message: "Invalid email address" }).max(255),
  password: z.string()
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
  const [isLinkingSubscription, setIsLinkingSubscription] = useState(false);
  const isSubmittingRef = useRef(false); // Use ref to avoid re-creating auth listener
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectUrl = searchParams.get("redirect");
  const pendingPlan = searchParams.get("plan");
  const pendingBilling = searchParams.get("billing");
  const sessionId = searchParams.get("session_id"); // For guest checkout linking
  const mode = searchParams.get("mode"); // 'signup' for guest checkout flow
  const startTrial = searchParams.get("startTrial"); // For starting trial from landing page

  // Set signup mode if coming from guest checkout or trial start
  useEffect(() => {
    if (mode === 'signup' || startTrial === 'true') {
      setIsLogin(false);
    }
  }, [mode, startTrial]);

  // Activate trial for the current user
  // Note: current_plan is auto-set to 'trial' by database trigger on profile creation
  // We only need to set trial_start_date here
  const activateTrial = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Check if user already has a trial - use maybeSingle to avoid throwing on no rows
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('trial_start_date')
        .eq('id', user.id)
        .maybeSingle();

      if (profileError) {
        console.error('Error checking trial status:', profileError);
        return;
      }

      if (profile?.trial_start_date) {
        // Already has trial, skip activation
        return;
      }

      // Activate trial by setting start date
      // current_plan is already 'trial' from the database trigger
      const { error } = await supabase
        .from('profiles')
        .update({
          trial_start_date: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (error) {
        console.error('Error activating trial:', error);
        return;
      }

      toast({
        title: "Trial Activated!",
        description: "Enjoy 14 days of Pro features — no payment required",
      });
    } catch (error) {
      console.error('Error activating trial:', error);
    }
  };

  // Link subscription after signup/login if coming from guest checkout
  const linkSubscriptionToAccount = async () => {
    if (!sessionId) return;
    
    setIsLinkingSubscription(true);
    try {
      const { data, error } = await supabase.functions.invoke('link-subscription', {
        body: { sessionId },
      });

      if (error) {
        console.error('Error linking subscription:', error);
        toast({
          title: "Subscription Linking Failed",
          description: "Please contact support to link your subscription.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Subscription Activated",
          description: `Your ${pendingPlan || 'plan'} subscription is now active!`,
        });
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setIsLinkingSubscription(false);
    }
  };

  useEffect(() => {
    // Listen for auth state changes to handle redirects reliably
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        // Skip if handleSubmit is actively running — it handles its own navigation
        if (isSubmittingRef.current) return;
        
        if (session && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED')) {
          // If coming from guest checkout, link the subscription
          if (sessionId) {
            await linkSubscriptionToAccount();
          }
          
          // If there's a redirect URL, go there instead of dashboard
          if (redirectUrl) {
            const fullRedirect = pendingPlan && pendingBilling 
              ? `${redirectUrl}?plan=${pendingPlan}&billing=${pendingBilling}`
              : redirectUrl;
            navigate(fullRedirect);
          } else {
            navigate("/dashboard");
          }
        }
      }
    );

    // Also check on mount for existing session
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        if (sessionId) {
          await linkSubscriptionToAccount();
        }
        if (redirectUrl) {
          const fullRedirect = pendingPlan && pendingBilling 
            ? `${redirectUrl}?plan=${pendingPlan}&billing=${pendingBilling}`
            : redirectUrl;
          navigate(fullRedirect);
        } else {
          navigate("/dashboard");
        }
      }
    };
    checkUser();

    return () => {
      subscription.unsubscribe();
    };
  }, [navigate, redirectUrl, pendingPlan, pendingBilling, sessionId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    isSubmittingRef.current = true;

    // Safety timeout to prevent infinite "Please Wait..." state
    const safetyTimeout = setTimeout(() => {
      setLoading(false);
      toast({
        title: "Request timed out",
        description: "Please try again.",
        variant: "destructive",
      });
    }, 30000);

    try {
      // For login, only validate email format (password was created before, might not meet current rules)
      // For signup, validate both email and password
      const validatedData = isLogin 
        ? { email: z.string().trim().email().max(255).parse(email), password }
        : authSchema.parse({ email, password });

      if (isLogin) {
        const { error, data } = await supabase.auth.signInWithPassword({
          email: validatedData.email,
          password: validatedData.password,
        });

        if (error) {
          if (error.message.includes("Invalid login credentials")) {
            // Auto-switch to signup for likely new users
            setIsLogin(false);
            toast({
              title: "No account found",
              description: "It looks like you're new! We've switched to Sign Up — just set a password to create your account.",
            });
          } else {
            toast({
              title: "Error",
              description: error.message,
              variant: "destructive",
            });
          }
        } else {
          // Link subscription if coming from guest checkout
          if (sessionId) {
            await linkSubscriptionToAccount();
          }
          
          // Check if profile is complete - use maybeSingle to avoid throwing on no rows
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('first_name, last_name, company_name')
            .eq('id', data.user.id)
            .maybeSingle();
          
          if (profileError) {
            console.error('Error fetching profile:', profileError);
          }

          const isProfileComplete = profile?.first_name && profile?.last_name && profile?.company_name;

          toast({
            title: t('auth.success.loggedIn').split('!')[0],
            description: t('auth.success.loggedIn'),
          });
          
          // If there's a redirect URL (e.g., from pricing page), go there
          if (redirectUrl) {
            const fullRedirect = pendingPlan && pendingBilling 
              ? `${redirectUrl}?plan=${pendingPlan}&billing=${pendingBilling}`
              : redirectUrl;
            navigate(fullRedirect);
          } else {
            navigate("/dashboard");
          }
        }
      } else {
        const { error, data } = await supabase.auth.signUp({
          email: validatedData.email,
          password: validatedData.password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
          },
        });

        if (error) {
          if (error.message.includes("already registered")) {
            toast({
              title: t('auth.errors.accountExists'),
              description: t('auth.errors.emailRegistered'),
              variant: "destructive",
            });
          } else {
            toast({
              title: "Error",
              description: error.message,
              variant: "destructive",
            });
          }
        } else {
          // Capture lead in database (non-blocking)
          supabase.functions.invoke("capture-lead", {
            body: {
              email: validatedData.email,
              source: "trial_signup",
              sequence: "trial",
            },
          }).catch((leadError) => {
            console.error("Lead capture failed:", leadError);
          });

          // Send to Zapier webhook for Google Sheets (non-blocking)
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
          }).catch((zapierError) => {
            console.error("Zapier webhook failed:", zapierError);
          });

          // Check if signup auto-logged in (auto-confirm enabled)
          const isAutoLoggedIn = !!data.session;

          if (!isAutoLoggedIn) {
            // Email confirmation required — user must verify first
            toast({
              title: t('auth.success.accountCreated').split('!')[0],
              description: t('auth.success.accountCreated'),
            });
            setIsLogin(true);
          } else {
            // Already logged in from signup — no need for redundant signInWithPassword
            // Link subscription if coming from guest checkout
            if (sessionId) {
              await linkSubscriptionToAccount();
            }
            
            // Activate trial if coming from "Get Started Free" button
            if (startTrial === 'true') {
              await activateTrial();
            }
            
            toast({
              title: t('auth.success.accountCreated').split('!')[0],
              description: startTrial === 'true' ? "Your 14-day Pro trial is now active!" : "You're now logged in!",
            });
            
            // Redirect
            if (redirectUrl) {
              const fullRedirect = pendingPlan && pendingBilling 
                ? `${redirectUrl}?plan=${pendingPlan}&billing=${pendingBilling}`
                : redirectUrl;
              navigate(fullRedirect);
            } else {
              navigate("/dashboard");
            }
          }
        }
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({
          title: t('auth.errors.validationError'),
          description: error.errors[0].message,
          variant: "destructive",
        });
      } else {
        toast({
          title: t('auth.errors.validationError'),
          description: t('auth.errors.unexpectedError'),
          variant: "destructive",
        });
      }
    } finally {
      clearTimeout(safetyTimeout);
      setLoading(false);
      isSubmittingRef.current = false;
    }
  };

  const handleGoogleLogin = async () => {
    try {
      const { error } = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });

      if (error) {
        toast({
          title: "Error",
          description: error.message || "Failed to sign in with Google",
          variant: "destructive",
        });
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

      if (error) throw error;

      toast({
        title: t('auth.success.resetEmailSent'),
        description: t('auth.success.checkEmail'),
      });
    } catch (error: any) {
      toast({
        title: t('auth.errors.validationError'),
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="dark min-h-screen">
      <div className="flex min-h-screen w-full flex-col items-center justify-center bg-background p-4 animate-fade-in">

        <div className="w-full max-w-sm">
          {/* Logo */}
          <div className="flex justify-center pb-8">
            <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-primary/20">
              <FileText className="h-10 w-10 text-primary" strokeWidth={2} />
            </div>
          </div>

          {/* Headline */}
          <h1 className="pb-2 text-center text-[32px] font-bold leading-tight tracking-tight text-foreground">
            {isLogin ? t('auth.welcomeBack') : t('auth.createAccount')}
          </h1>
          <p className="pb-8 text-center text-sm text-muted-foreground">
            {isLogin ? t('auth.loginToContinue') : t('auth.signupToGetStarted')}
          </p>

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* Email Field */}
            <div className="flex w-full flex-col">
              <Label htmlFor="email" className="pb-2 text-base font-medium text-foreground/90">
                {t('auth.emailAddress')}
              </Label>
              <Input
                id="email"
                type="email"
                placeholder={t('auth.emailPlaceholder')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-12 rounded-lg border-input bg-input/50 text-base text-foreground placeholder:text-muted-foreground focus-visible:ring-primary"
                required
              />
            </div>

            {/* Password Field */}
            <div className="flex w-full flex-col">
              <Label htmlFor="password" className="pb-2 text-base font-medium text-foreground/90">
                {t('auth.password')}
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder={t('auth.passwordPlaceholder')}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-12 rounded-lg border-input bg-input/50 pr-12 text-base text-foreground placeholder:text-muted-foreground focus-visible:ring-primary"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>

            {/* Forgot Password Link (only show on login) */}
            {isLogin && (
              <div className="flex justify-end">
                <button
                  type="button"
                  className="text-sm font-medium text-primary hover:underline"
                  onClick={handlePasswordReset}
                >
                  {t('auth.forgotPassword')}
                </button>
              </div>
            )}

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={loading}
              className="h-12 w-full rounded-lg bg-primary text-base font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              {loading ? t('auth.pleaseWait') : isLogin ? t('auth.logIn') : t('auth.signUp')}
            </Button>

            {/* Toggle between login and signup */}
            <div className="text-center text-sm text-muted-foreground">
              {isLogin ? t('auth.dontHaveAccount') : t('auth.alreadyHaveAccount')}
              {' '}
              <button
                type="button"
                onClick={() => setIsLogin(!isLogin)}
                className="font-semibold text-primary underline underline-offset-2 hover:text-primary/80 transition-colors"
              >
                {isLogin ? t('auth.signUp') : t('auth.logIn')}
              </button>
            </div>

            {/* Divider */}
            <div className="relative py-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="bg-background px-2 text-muted-foreground">
                  {t('auth.orContinueWith')}
                </span>
              </div>
            </div>

            {/* Google Login Button */}
            <Button
              type="button"
              onClick={handleGoogleLogin}
              variant="outline"
              className="h-12 w-full rounded-lg border-input bg-transparent text-base font-medium text-foreground hover:bg-input/30 transition-colors"
            >
              <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              {t('auth.continueWithGoogle')}
            </Button>

            {/* Biometric Login Button (only show on login) */}
            {isLogin && (
              <Button
                type="button"
                variant="outline"
                onClick={handleBiometricLogin}
                className="h-12 w-full rounded-lg border-input bg-transparent text-base font-medium text-foreground hover:bg-input/30 transition-colors"
              >
                <Fingerprint className="mr-2 h-5 w-5" />
                {t('auth.loginWithBiometrics')}
              </Button>
            )}
          </form>
        </div>
      </div>
    </div>
  );
};

export default Auth;
