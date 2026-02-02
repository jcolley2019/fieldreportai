import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { differenceInCalendarDays, parseISO, startOfDay } from "date-fns";
import { Clock, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

interface TrialBannerProps {
  trialStartDate: string;
  onDismiss?: () => void;
}

export const TrialBanner = ({ trialStartDate, onDismiss }: TrialBannerProps) => {
  const [daysRemaining, setDaysRemaining] = useState(14);
  const navigate = useNavigate();
  const { t } = useTranslation();

  useEffect(() => {
    const calculateDaysRemaining = () => {
      const startDate = startOfDay(parseISO(trialStartDate));
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 14);
      
      // Use differenceInCalendarDays to count by calendar days, not exact time
      const remaining = differenceInCalendarDays(endDate, startOfDay(new Date()));
      setDaysRemaining(Math.max(0, remaining));
    };

    calculateDaysRemaining();
    // Update daily
    const interval = setInterval(calculateDaysRemaining, 86400000);
    
    return () => clearInterval(interval);
  }, [trialStartDate]);

  if (daysRemaining < 0) return null;

  return (
    <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 mb-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20">
            <Clock className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">14-Day Trial Active</h3>
            <p className="text-sm text-muted-foreground">
              {daysRemaining === 0 ? (
                <span className="text-destructive font-medium">Trial expires today!</span>
              ) : daysRemaining === 1 ? (
                <span className="text-destructive font-medium">1 day remaining</span>
              ) : (
                <span>{daysRemaining} {t('dashboard.trialDaysRemaining')}</span>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {onDismiss && (
            <Button
              onClick={onDismiss}
              size="icon"
              variant="ghost"
              className="h-8 w-8"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
