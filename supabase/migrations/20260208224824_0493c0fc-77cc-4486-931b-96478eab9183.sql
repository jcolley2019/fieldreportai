-- Add GPS stamping preference to profiles table (default OFF)
ALTER TABLE public.profiles
ADD COLUMN gps_stamping_enabled boolean NOT NULL DEFAULT false;