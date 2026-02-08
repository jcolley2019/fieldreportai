-- Add GPS and timestamp columns to media table
ALTER TABLE public.media
ADD COLUMN latitude double precision,
ADD COLUMN longitude double precision,
ADD COLUMN captured_at timestamp with time zone DEFAULT now(),
ADD COLUMN location_name text;

-- Add index for location-based queries
CREATE INDEX idx_media_location ON public.media (latitude, longitude) WHERE latitude IS NOT NULL AND longitude IS NOT NULL;