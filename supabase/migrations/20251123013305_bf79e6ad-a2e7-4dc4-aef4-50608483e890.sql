-- Fix the function to include search_path
CREATE OR REPLACE FUNCTION public.is_trial_active(user_id UUID)
RETURNS BOOLEAN 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;