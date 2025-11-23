-- Create storage bucket for company letterheads
INSERT INTO storage.buckets (id, name, public)
VALUES ('letterheads', 'letterheads', false);

-- Add letterhead_url column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN letterhead_url text;

-- Create RLS policies for letterheads bucket
CREATE POLICY "Users can view own letterhead"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'letterheads' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Premium and Enterprise users can upload letterhead"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'letterheads' 
  AND auth.uid()::text = (storage.foldername(name))[1]
  AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND current_plan IN ('premium', 'enterprise')
  )
);

CREATE POLICY "Premium and Enterprise users can update letterhead"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'letterheads' 
  AND auth.uid()::text = (storage.foldername(name))[1]
  AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND current_plan IN ('premium', 'enterprise')
  )
);

CREATE POLICY "Premium and Enterprise users can delete letterhead"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'letterheads' 
  AND auth.uid()::text = (storage.foldername(name))[1]
  AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND current_plan IN ('premium', 'enterprise')
  )
);