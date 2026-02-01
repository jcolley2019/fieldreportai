import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type PlanType = 'trial' | 'basic' | 'pro' | 'premium' | 'enterprise' | null;

interface PlanFeatures {
  maxRecordingSeconds: number;
  maxRecordingMinutes: number;
  hasCustomLetterhead: boolean;
  hasCustomBranding: boolean;
  hasApiAccess: boolean;
  planName: string;
  maxReportsPerMonth: number | null; // null = unlimited
}

interface SubscriptionInfo {
  subscribed: boolean;
  plan: string | null;
  subscription_end: string | null;
}

const PLAN_FEATURES: Record<string, PlanFeatures> = {
  trial: {
    maxRecordingSeconds: 300, // 5 minutes
    maxRecordingMinutes: 5,
    hasCustomLetterhead: false,
    hasCustomBranding: false,
    hasApiAccess: false,
    planName: 'Pro Trial',
    maxReportsPerMonth: null, // unlimited during trial
  },
  basic: {
    maxRecordingSeconds: 60, // 1 minute
    maxRecordingMinutes: 1,
    hasCustomLetterhead: false,
    hasCustomBranding: false,
    hasApiAccess: false,
    planName: 'Basic',
    maxReportsPerMonth: 3,
  },
  pro: {
    maxRecordingSeconds: 300, // 5 minutes
    maxRecordingMinutes: 5,
    hasCustomLetterhead: false,
    hasCustomBranding: false,
    hasApiAccess: false,
    planName: 'Pro',
    maxReportsPerMonth: null, // unlimited
  },
  premium: {
    maxRecordingSeconds: 600, // 10 minutes
    maxRecordingMinutes: 10,
    hasCustomLetterhead: true,
    hasCustomBranding: true,
    hasApiAccess: true,
    planName: 'Premium',
    maxReportsPerMonth: null, // unlimited
  },
  enterprise: {
    maxRecordingSeconds: 600, // 10 minutes
    maxRecordingMinutes: 10,
    hasCustomLetterhead: true,
    hasCustomBranding: true,
    hasApiAccess: true,
    planName: 'Enterprise',
    maxReportsPerMonth: null, // unlimited
  },
};

// Default to basic features for users without a plan
const DEFAULT_FEATURES = PLAN_FEATURES.basic;

export const usePlanFeatures = () => {
  const [currentPlan, setCurrentPlan] = useState<PlanType>(null);
  const [features, setFeatures] = useState<PlanFeatures>(DEFAULT_FEATURES);
  const [isLoading, setIsLoading] = useState(true);
  const [isTrialActive, setIsTrialActive] = useState(false);
  const [isTrialExpired, setIsTrialExpired] = useState(false);
  const [trialDaysRemaining, setTrialDaysRemaining] = useState<number | null>(null);
  const [trialDaysExpired, setTrialDaysExpired] = useState<number>(0);
  const [subscriptionEnd, setSubscriptionEnd] = useState<string | null>(null);

  const checkStripeSubscription = useCallback(async (): Promise<SubscriptionInfo | null> => {
    try {
      const { data, error } = await supabase.functions.invoke('check-subscription');
      if (error) {
        console.error('Error checking subscription:', error);
        return null;
      }
      return data as SubscriptionInfo;
    } catch (error) {
      console.error('Error invoking check-subscription:', error);
      return null;
    }
  }, []);

  const fetchPlan = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        setFeatures(DEFAULT_FEATURES);
        setIsLoading(false);
        return;
      }

      // First check Stripe subscription status
      const subscriptionInfo = await checkStripeSubscription();
      
      if (subscriptionInfo?.subscribed && subscriptionInfo.plan) {
        const plan = subscriptionInfo.plan as PlanType;
        setCurrentPlan(plan);
        setSubscriptionEnd(subscriptionInfo.subscription_end);
        setIsTrialActive(false);
        setIsTrialExpired(false);
        setTrialDaysRemaining(null);
        setTrialDaysExpired(0);
        const planFeatures = PLAN_FEATURES[plan] || DEFAULT_FEATURES;
        setFeatures(planFeatures);
        setIsLoading(false);
        return;
      }

      // Fall back to profile data for trial/basic users
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('current_plan, trial_start_date')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('Error fetching plan:', error);
        setFeatures(DEFAULT_FEATURES);
        setIsLoading(false);
        return;
      }

      let plan = profile?.current_plan as PlanType || 'basic';
      
      // Check trial status
      if (profile?.trial_start_date) {
        const trialStart = new Date(profile.trial_start_date);
        const trialEnd = new Date(trialStart.getTime() + 14 * 24 * 60 * 60 * 1000);
        const now = new Date();
        
        if (now < trialEnd) {
          // Trial is still active
          const daysRemaining = Math.ceil((trialEnd.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
          setIsTrialActive(true);
          setIsTrialExpired(false);
          setTrialDaysRemaining(daysRemaining);
          setTrialDaysExpired(0);
          plan = 'trial';
        } else {
          // Trial has expired - downgrade to basic
          const daysExpired = Math.floor((now.getTime() - trialEnd.getTime()) / (24 * 60 * 60 * 1000));
          setIsTrialActive(false);
          setIsTrialExpired(true);
          setTrialDaysRemaining(0);
          setTrialDaysExpired(daysExpired);
          plan = 'basic';
        }
      } else if (plan === 'trial') {
        // Has trial plan but no start date - treat as basic
        plan = 'basic';
      }

      setCurrentPlan(plan);

      // Set features based on plan
      const planFeatures = PLAN_FEATURES[plan] || DEFAULT_FEATURES;
      setFeatures(planFeatures);
    } catch (error) {
      console.error('Error in usePlanFeatures:', error);
      setFeatures(DEFAULT_FEATURES);
    } finally {
      setIsLoading(false);
    }
  }, [checkStripeSubscription]);

  useEffect(() => {
    fetchPlan();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      fetchPlan();
    });

    // Check subscription status periodically (every 60 seconds)
    const interval = setInterval(() => {
      fetchPlan();
    }, 60000);

    return () => {
      subscription.unsubscribe();
      clearInterval(interval);
    };
  }, [fetchPlan]);

  return {
    currentPlan,
    features,
    isLoading,
    isTrialActive,
    isTrialExpired,
    trialDaysRemaining,
    trialDaysExpired,
    subscriptionEnd,
    isPremiumOrHigher: currentPlan === 'premium' || currentPlan === 'enterprise',
    isProOrHigher: currentPlan === 'pro' || currentPlan === 'premium' || currentPlan === 'enterprise',
    refreshPlan: fetchPlan,
  };
};

export const getPlanFeatures = (plan: PlanType): PlanFeatures => {
  if (!plan) return DEFAULT_FEATURES;
  return PLAN_FEATURES[plan] || DEFAULT_FEATURES;
};
