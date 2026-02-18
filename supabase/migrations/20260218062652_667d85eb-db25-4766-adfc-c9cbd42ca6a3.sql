
-- Create photo_comments table for public gallery commenting
CREATE TABLE public.photo_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  media_id UUID NOT NULL,
  share_token TEXT NOT NULL,
  commenter_name TEXT NOT NULL,
  comment_text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.photo_comments ENABLE ROW LEVEL SECURITY;

-- Public can insert comments (validated by share_token in application logic)
CREATE POLICY "Public can insert comments via share token"
ON public.photo_comments
FOR INSERT
WITH CHECK (
  char_length(commenter_name) BETWEEN 1 AND 100
  AND char_length(comment_text) BETWEEN 1 AND 1000
  AND char_length(share_token) BETWEEN 32 AND 128
);

-- Public can read comments for any share token (read-only public gallery)
CREATE POLICY "Public can view comments by share token"
ON public.photo_comments
FOR SELECT
USING (true);

-- Owners can delete comments on their shares (server-side via service role)
-- No client-side delete needed — service role handles cleanup

-- Index for fast lookup by media_id + share_token
CREATE INDEX idx_photo_comments_media_share ON public.photo_comments(media_id, share_token);
CREATE INDEX idx_photo_comments_share_token ON public.photo_comments(share_token);
