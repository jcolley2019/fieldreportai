-- Fix: restrict overly-permissive leads policy to service role only
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'leads'
      AND policyname = 'Service role can manage leads'
  ) THEN
    EXECUTE 'DROP POLICY "Service role can manage leads" ON public.leads';
  END IF;
END $$;

CREATE POLICY "Service role can manage leads"
ON public.leads
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);


-- Fix: prevent users from self-upgrading subscription plan / trial timestamps
CREATE OR REPLACE FUNCTION public.protect_subscription_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Allow privileged backend/service operations
  IF current_user IN ('service_role', 'postgres', 'supabase_admin') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    -- Users must never set an elevated plan on insert
    IF NEW.current_plan IS NULL OR NEW.current_plan <> 'trial' THEN
      NEW.current_plan := 'trial';
    END IF;

    -- Trial start can be set only close to "now" (prevents backdating/future-dating)
    IF NEW.trial_start_date IS NOT NULL THEN
      IF NEW.trial_start_date > now() + interval '5 minutes'
         OR NEW.trial_start_date < now() - interval '1 day' THEN
        RAISE EXCEPTION 'Not allowed to set trial_start_date to this value'
          USING ERRCODE = '42501';
      END IF;
    END IF;

    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Prevent self-upgrading/downgrading plan
    IF NEW.current_plan IS DISTINCT FROM OLD.current_plan THEN
      RAISE EXCEPTION 'Not allowed to change current_plan'
        USING ERRCODE = '42501';
    END IF;

    -- Allow setting trial_start_date only once; never change it after
    IF OLD.trial_start_date IS NULL AND NEW.trial_start_date IS NOT NULL THEN
      IF NEW.trial_start_date > now() + interval '5 minutes'
         OR NEW.trial_start_date < now() - interval '1 day' THEN
        RAISE EXCEPTION 'Invalid trial_start_date'
          USING ERRCODE = '42501';
      END IF;
    ELSIF OLD.trial_start_date IS NOT NULL AND NEW.trial_start_date IS DISTINCT FROM OLD.trial_start_date THEN
      RAISE EXCEPTION 'Not allowed to change trial_start_date'
        USING ERRCODE = '42501';
    END IF;

    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_subscription_fields_trigger ON public.profiles;
CREATE TRIGGER protect_subscription_fields_trigger
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.protect_subscription_fields();
