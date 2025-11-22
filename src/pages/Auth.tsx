import { useState, useEffect } from "react";
import { Eye, EyeOff, Fingerprint, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import { z } from "zod";

const authSchema = z.object({
  email: z.string().trim().email({ message: "Invalid email address" }).max(255),
  password: z.string()
    .min(8, { message: "Password must be at least 8 characters" })
    .max(100, { message: "Password must be less than 100 characters" }),
});

const Auth = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Check if user is already logged in
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        navigate("/dashboard");
      }
    };
    checkUser();
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

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
            toast({
              title: "Login failed",
              description: "Invalid email or password. Please try again.",
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
          // Check if profile is complete
          const { data: profile } = await supabase
            .from('profiles')
            .select('first_name, last_name, company_name')
            .eq('id', data.user.id)
            .single();

          const isProfileComplete = profile?.first_name && profile?.last_name && profile?.company_name;

          toast({
            title: "Success",
            description: "Logged in successfully!",
          });
          
          navigate(isProfileComplete ? "/dashboard" : "/onboarding");
        }
      } else {
        const { error } = await supabase.auth.signUp({
          email: validatedData.email,
          password: validatedData.password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
          },
        });

        if (error) {
          if (error.message.includes("already registered")) {
            toast({
              title: "Account exists",
              description: "This email is already registered. Please login instead.",
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
          toast({
            title: "Success",
            description: "Account created successfully! You can now log in.",
          });
          setIsLogin(true);
        }
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({
          title: "Validation Error",
          description: error.errors[0].message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: "An unexpected error occurred.",
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
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

      // Break out of the editor iframe to avoid accounts.google.com iframe refusal
      try {
        if (window.top) {
          (window.top as Window).location.href = url;
        } else {
          window.location.href = url;
        }
      } catch {
        // Fallback if cross-origin prevents accessing window.top
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
      title: "Coming Soon",
      description: "Biometric authentication will be available soon.",
    });
  };

  return (
    <div className="dark min-h-screen">
      <div className="flex min-h-screen w-full flex-col items-center justify-center bg-background p-4">
        <div className="w-full max-w-sm">
          {/* Logo */}
          <div className="flex justify-center pb-8">
            <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-primary/20">
              <FileText className="h-10 w-10 text-primary" strokeWidth={2} />
            </div>
          </div>

          {/* Headline */}
          <h1 className="pb-2 text-center text-[32px] font-bold leading-tight tracking-tight text-foreground">
            {isLogin ? "Welcome Back" : "Create Account"}
          </h1>
          <p className="pb-8 text-center text-sm text-muted-foreground">
            {isLogin ? "Log in to continue" : "Sign up to get started"}
          </p>

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* Email Field */}
            <div className="flex w-full flex-col">
              <Label htmlFor="email" className="pb-2 text-base font-medium text-foreground/90">
                Email Address
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-12 rounded-lg border-input bg-input/50 text-base text-foreground placeholder:text-muted-foreground focus-visible:ring-primary"
                required
              />
            </div>

            {/* Password Field */}
            <div className="flex w-full flex-col">
              <Label htmlFor="password" className="pb-2 text-base font-medium text-foreground/90">
                Password
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-12 rounded-lg border-input bg-input/50 pr-12 text-base text-foreground placeholder:text-muted-foreground focus-visible:ring-primary"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={showPassword ? "Hide password" : "Show password"}
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
                <a
                  href="#"
                  className="text-sm font-medium text-primary hover:underline"
                  onClick={(e) => {
                    e.preventDefault();
                    toast({
                      title: "Password Reset",
                      description: "Password reset functionality coming soon.",
                    });
                  }}
                >
                  Forgot Password?
                </a>
              </div>
            )}

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={loading}
              className="h-12 w-full rounded-lg bg-primary text-base font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              {loading ? "Please wait..." : isLogin ? "Log In" : "Sign Up"}
            </Button>

            {/* Divider */}
            <div className="relative py-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="bg-background px-2 text-muted-foreground">
                  or continue with
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
              Continue with Google
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
                Login with Biometrics
              </Button>
            )}

            {/* Toggle between login and signup */}
            <div className="text-center text-sm text-muted-foreground">
              {isLogin ? "Don't have an account? " : "Already have an account? "}
              <button
                type="button"
                onClick={() => setIsLogin(!isLogin)}
                className="font-medium text-primary hover:underline"
              >
                {isLogin ? "Sign Up" : "Log In"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Auth;
