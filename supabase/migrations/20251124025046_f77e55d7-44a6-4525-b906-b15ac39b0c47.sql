-- Allow authenticated users to view leads (for admin/owner dashboard access)
CREATE POLICY "Authenticated users can view all leads"
ON public.leads
FOR SELECT
TO authenticated
USING (true);