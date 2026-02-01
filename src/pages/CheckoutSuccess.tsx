import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { CheckCircle, Sparkles, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const CheckoutSuccess = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [countdown, setCountdown] = useState(5);
  const [isLinkingSubscription, setIsLinkingSubscription] = useState(false);
  
  const isGuest = searchParams.get('guest') === 'true';
  const sessionId = searchParams.get('session_id');
  const plan = searchParams.get('plan') || 'pro';

  // For existing users, redirect to dashboard after countdown
  useEffect(() => {
    if (isGuest) return; // Don't auto-redirect guests

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          navigate("/dashboard");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [navigate, isGuest]);

  // For guests, check if they're now logged in and link their subscription
  useEffect(() => {
    const linkSubscriptionToAccount = async () => {
      if (!isGuest || !sessionId) return;

      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        setIsLinkingSubscription(true);
        try {
          const { data, error } = await supabase.functions.invoke('link-subscription', {
            body: { sessionId },
          });

          if (error) {
            console.error('Error linking subscription:', error);
            toast.error("Failed to link subscription. Please contact support.");
          } else {
            toast.success(`${plan.charAt(0).toUpperCase() + plan.slice(1)} subscription activated!`);
            navigate("/dashboard");
          }
        } catch (error) {
          console.error('Error:', error);
        } finally {
          setIsLinkingSubscription(false);
        }
      }
    };

    linkSubscriptionToAccount();
  }, [isGuest, sessionId, plan, navigate]);

  const handleContinueToSignup = () => {
    // Redirect to auth with session info to link after signup
    navigate(`/auth?session_id=${sessionId}&plan=${plan}&mode=signup`);
  };

  // Guest flow - prompt to create account
  if (isGuest) {
    return (
      <div className="dark min-h-screen bg-background flex items-center justify-center p-4">
        <div className="glass-card max-w-md w-full p-8 text-center animate-fade-in">
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div className="h-20 w-20 rounded-full bg-green-500/20 flex items-center justify-center">
                <CheckCircle className="h-10 w-10 text-green-500" />
              </div>
              <div className="absolute -top-1 -right-1 h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center animate-pulse">
                <Sparkles className="h-4 w-4 text-primary" />
              </div>
            </div>
          </div>
          
          <h1 className="text-2xl font-bold text-foreground mb-2">
            Payment Successful!
          </h1>
          
          <p className="text-muted-foreground mb-6">
            Your {plan.charAt(0).toUpperCase() + plan.slice(1)} subscription is ready. Create your account to get started.
          </p>
          
          <div className="bg-muted/30 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-center gap-2 text-primary">
              <UserPlus className="h-5 w-5" />
              <span className="font-medium">One more step!</span>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              Create an account to access your subscription and all premium features.
            </p>
          </div>
          
          <Button 
            onClick={handleContinueToSignup} 
            className="w-full"
            disabled={isLinkingSubscription}
          >
            {isLinkingSubscription ? "Linking subscription..." : "Create Account"}
          </Button>
        </div>
      </div>
    );
  }

  // Existing user flow - auto-redirect to dashboard
  return (
    <div className="dark min-h-screen bg-background flex items-center justify-center p-4">
      <div className="glass-card max-w-md w-full p-8 text-center animate-fade-in">
        <div className="flex justify-center mb-6">
          <div className="relative">
            <div className="h-20 w-20 rounded-full bg-green-500/20 flex items-center justify-center">
              <CheckCircle className="h-10 w-10 text-green-500" />
            </div>
            <div className="absolute -top-1 -right-1 h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center animate-pulse">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
          </div>
        </div>
        
        <h1 className="text-2xl font-bold text-foreground mb-2">
          Subscription Activated!
        </h1>
        
        <p className="text-muted-foreground mb-6">
          Thank you for subscribing! Your account has been upgraded and you now have access to all premium features.
        </p>
        
        <div className="bg-muted/30 rounded-lg p-4 mb-6">
          <p className="text-sm text-muted-foreground">
            Redirecting to dashboard in <span className="text-primary font-semibold">{countdown}</span> seconds...
          </p>
        </div>
        
        <Button 
          onClick={() => navigate("/dashboard")} 
          className="w-full"
        >
          Go to Dashboard
        </Button>
      </div>
    </div>
  );
};

export default CheckoutSuccess;
