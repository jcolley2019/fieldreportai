import { Badge } from "@/components/ui/badge";
import { Crown, Sparkles } from "lucide-react";

interface SubscriptionBadgeProps {
  plan: string | null;
  className?: string;
}

export const SubscriptionBadge = ({ plan, className = "" }: SubscriptionBadgeProps) => {
  if (!plan || plan === 'trial' || plan === 'free') return null;

  const isPremium = plan === 'premium';
  const isPro = plan === 'pro';

  if (!isPro && !isPremium) return null;

  return (
    <Badge 
      variant="outline"
      className={`
        gap-1.5 px-3 py-1.5 text-sm font-semibold border-2 
        ${isPremium 
          ? 'bg-gradient-to-r from-amber-500/20 to-orange-500/20 border-amber-500/50 text-amber-400' 
          : 'bg-gradient-to-r from-primary/20 to-blue-500/20 border-primary/50 text-primary'
        }
        ${className}
      `}
    >
      {isPremium ? (
        <Crown className="h-4 w-4" />
      ) : (
        <Sparkles className="h-4 w-4" />
      )}
      {isPremium ? 'Premium' : 'Pro'}
    </Badge>
  );
};
