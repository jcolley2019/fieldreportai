
-- Allow project owners to delete comments on photos belonging to their reports
CREATE POLICY "Project owners can delete comments on their shares"
ON public.photo_comments
FOR DELETE
USING (
  EXISTS (
    SELECT 1
    FROM public.project_shares ps
    WHERE ps.share_token = photo_comments.share_token
      AND ps.user_id = auth.uid()
  )
);
