import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, Sparkles, Crown, ArrowRight } from "lucide-react";

interface TrialExpiredModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  daysExpired?: number;
}

export const TrialExpiredModal = ({ open, onOpenChange, daysExpired = 0 }: TrialExpiredModalProps) => {
  const navigate = useNavigate();
  const [selectedPlan, setSelectedPlan] = useState<'pro' | 'premium' | null>(null);

  const handleUpgrade = (plan: 'pro' | 'premium') => {
    onOpenChange(false);
    navigate(`/pricing?plan=${plan}&billing=monthly`);
  };

  const handleContinueBasic = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center justify-center mb-4">
            <div className="h-16 w-16 rounded-full bg-amber-500/20 flex items-center justify-center">
              <Clock className="h-8 w-8 text-amber-500" />
            </div>
          </div>
          <DialogTitle className="text-center text-2xl">
            Your Pro Trial Has Ended
          </DialogTitle>
          <DialogDescription className="text-center">
            {daysExpired > 0 
              ? `Your trial expired ${daysExpired} day${daysExpired > 1 ? 's' : ''} ago.`
              : "Your 14-day Pro trial has ended."
            }
            {" "}Choose a plan to continue accessing premium features.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-6">
          {/* Pro Plan Option */}
          <div 
            className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
              selectedPlan === 'pro' 
                ? 'border-primary bg-primary/10' 
                : 'border-border hover:border-primary/50'
            }`}
            onClick={() => setSelectedPlan('pro')}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
                  <Sparkles className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">Pro Plan</span>
                    <Badge variant="secondary">Most Popular</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">$49/month • Unlimited reports</p>
                </div>
              </div>
              <Button 
                size="sm" 
                onClick={(e) => {
                  e.stopPropagation();
                  handleUpgrade('pro');
                }}
              >
                Upgrade <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Premium Plan Option */}
          <div 
            className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
              selectedPlan === 'premium' 
                ? 'border-amber-500 bg-amber-500/10' 
                : 'border-border hover:border-amber-500/50'
            }`}
            onClick={() => setSelectedPlan('premium')}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                  <Crown className="h-5 w-5 text-amber-500" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">Premium Plan</span>
                  </div>
                  <p className="text-sm text-muted-foreground">$99/month • Custom branding & API</p>
                </div>
              </div>
              <Button 
                size="sm" 
                variant="outline"
                className="border-amber-500 text-amber-500 hover:bg-amber-500/10"
                onClick={(e) => {
                  e.stopPropagation();
                  handleUpgrade('premium');
                }}
              >
                Upgrade <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-border">
          <p className="text-sm text-muted-foreground text-center mb-3">
            Not ready to upgrade? You can continue with limited features.
          </p>
          <Button 
            variant="ghost" 
            className="w-full text-muted-foreground"
            onClick={handleContinueBasic}
          >
            Continue with Basic (Free)
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
