import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type PlanType = 'trial' | 'pro' | 'premium' | 'enterprise' | null;

interface PlanFeatures {
  maxRecordingSeconds: number;
  maxRecordingMinutes: number;
  hasCustomLetterhead: boolean;
  hasCustomBranding: boolean;
  hasApiAccess: boolean;
  planName: string;
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
  },
  pro: {
    maxRecordingSeconds: 300, // 5 minutes
    maxRecordingMinutes: 5,
    hasCustomLetterhead: false,
    hasCustomBranding: false,
    hasApiAccess: false,
    planName: 'Pro',
  },
  premium: {
    maxRecordingSeconds: 600, // 10 minutes
    maxRecordingMinutes: 10,
    hasCustomLetterhead: true,
    hasCustomBranding: true,
    hasApiAccess: true,
    planName: 'Premium',
  },
  enterprise: {
    maxRecordingSeconds: 600, // 10 minutes
    maxRecordingMinutes: 10,
    hasCustomLetterhead: true,
    hasCustomBranding: true,
    hasApiAccess: true,
    planName: 'Enterprise',
  },
};

// Default to trial features for users without a plan
const DEFAULT_FEATURES = PLAN_FEATURES.trial;

export const usePlanFeatures = () => {
  const [currentPlan, setCurrentPlan] = useState<PlanType>(null);
  const [features, setFeatures] = useState<PlanFeatures>(DEFAULT_FEATURES);
  const [isLoading, setIsLoading] = useState(true);
  const [isTrialActive, setIsTrialActive] = useState(false);
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
        const planFeatures = PLAN_FEATURES[plan] || DEFAULT_FEATURES;
        setFeatures(planFeatures);
        setIsLoading(false);
        return;
      }

      // Fall back to profile data for trial users
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

      const plan = profile?.current_plan as PlanType || 'trial';
      setCurrentPlan(plan);

      // Check if trial is still active
      if (plan === 'trial' && profile?.trial_start_date) {
        const trialStart = new Date(profile.trial_start_date);
        const trialEnd = new Date(trialStart.getTime() + 14 * 24 * 60 * 60 * 1000);
        setIsTrialActive(new Date() < trialEnd);
      }

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
    subscriptionEnd,
    isPremiumOrHigher: currentPlan === 'premium' || currentPlan === 'enterprise',
    refreshPlan: fetchPlan,
  };
};

export const getPlanFeatures = (plan: PlanType): PlanFeatures => {
  if (!plan) return DEFAULT_FEATURES;
  return PLAN_FEATURES[plan] || DEFAULT_FEATURES;
};
