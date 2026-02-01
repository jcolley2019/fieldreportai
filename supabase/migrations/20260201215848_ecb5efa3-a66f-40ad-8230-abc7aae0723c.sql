-- Add idle_timeout_minutes column to profiles table
-- NULL means use default (15 minutes), 0 means disabled
ALTER TABLE public.profiles 
ADD COLUMN idle_timeout_minutes integer DEFAULT NULL;

-- Add a comment explaining the values
COMMENT ON COLUMN public.profiles.idle_timeout_minutes IS 'User preference for idle timeout in minutes. NULL = default (15 min), 0 = disabled, other values = custom timeout';