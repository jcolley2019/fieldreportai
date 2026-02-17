
-- Share access audit log
CREATE TABLE public.share_access_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  share_id uuid NOT NULL REFERENCES public.project_shares(id) ON DELETE CASCADE,
  accessed_at timestamptz NOT NULL DEFAULT now(),
  ip_address text,
  user_agent text
);

ALTER TABLE public.share_access_log ENABLE ROW LEVEL SECURITY;

-- Only share owners can view access logs
CREATE POLICY "Share owners can view access logs"
ON public.share_access_log
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.project_shares
    WHERE project_shares.id = share_access_log.share_id
      AND project_shares.user_id = auth.uid()
  )
);

-- Service role inserts (from edge function)
CREATE POLICY "Service role can insert access logs"
ON public.share_access_log
FOR INSERT
WITH CHECK (true);

-- Add original_file_path to media for preserving originals before annotation
ALTER TABLE public.media ADD COLUMN original_file_path text;
