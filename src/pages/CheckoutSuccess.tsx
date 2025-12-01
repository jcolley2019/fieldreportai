import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { CheckCircle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

const CheckoutSuccess = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          navigate("/auth");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [navigate]);

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
            Redirecting to login in <span className="text-primary font-semibold">{countdown}</span> seconds...
          </p>
        </div>
        
        <Button 
          onClick={() => navigate("/auth")} 
          className="w-full"
        >
          Continue to Login
        </Button>
      </div>
    </div>
  );
};

export default CheckoutSuccess;
