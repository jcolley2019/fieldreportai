-- Add trial tracking fields to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS trial_start_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS current_plan TEXT DEFAULT 'trial';

-- Create an index for better query performance
CREATE INDEX IF NOT EXISTS idx_profiles_trial_start ON public.profiles(trial_start_date);

-- Create a function to check if trial is active
CREATE OR REPLACE FUNCTION public.is_trial_active(user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  trial_start TIMESTAMP WITH TIME ZONE;
  trial_days INTEGER := 14;
BEGIN
  SELECT trial_start_date INTO trial_start
  FROM public.profiles
  WHERE id = user_id;
  
  IF trial_start IS NULL THEN
    RETURN FALSE;
  END IF;
  
  RETURN (trial_start + (trial_days || ' days')::INTERVAL) > NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;