
-- ============================================================
-- FIX 1: Leads table - remove any overly permissive SELECT policy
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can view all leads" ON public.leads;

-- Ensure admin-only SELECT policy exists (idempotent)
DROP POLICY IF EXISTS "Only admins can view leads" ON public.leads;
CREATE POLICY "Only admins can view leads"
ON public.leads
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- ============================================================
-- FIX 2: Team member access - UPDATE SELECT policies so accepted
-- team members can view shared project data.
-- Also add editor-level UPDATE policies for each table.
-- ============================================================

-- reports
DROP POLICY IF EXISTS "Users can view own reports" ON public.reports;
CREATE POLICY "Users can view own and team reports"
ON public.reports
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  OR public.has_team_access(id, auth.uid())
);

DROP POLICY IF EXISTS "Team editors can update reports" ON public.reports;
CREATE POLICY "Team editors can update reports"
ON public.reports
FOR UPDATE
TO authenticated
USING (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM public.team_members
    WHERE report_id = reports.id
      AND member_user_id = auth.uid()
      AND accepted_at IS NOT NULL
      AND role IN ('editor', 'admin')
  )
);

-- media
DROP POLICY IF EXISTS "Users can view own media" ON public.media;
CREATE POLICY "Users can view own and team media"
ON public.media
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  OR public.has_team_access(report_id, auth.uid())
);

DROP POLICY IF EXISTS "Team editors can update media" ON public.media;
CREATE POLICY "Team editors can update media"
ON public.media
FOR UPDATE
TO authenticated
USING (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM public.team_members
    WHERE report_id = media.report_id
      AND member_user_id = auth.uid()
      AND accepted_at IS NOT NULL
      AND role IN ('editor', 'admin')
  )
);

-- documents
DROP POLICY IF EXISTS "Users can view own documents" ON public.documents;
CREATE POLICY "Users can view own and team documents"
ON public.documents
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  OR public.has_team_access(report_id, auth.uid())
);

-- notes
DROP POLICY IF EXISTS "Users can view own notes" ON public.notes;
CREATE POLICY "Users can view own and team notes"
ON public.notes
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  OR (report_id IS NOT NULL AND public.has_team_access(report_id, auth.uid()))
);

-- tasks
DROP POLICY IF EXISTS "Users can view own tasks" ON public.tasks;
CREATE POLICY "Users can view own and team tasks"
ON public.tasks
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  OR (report_id IS NOT NULL AND public.has_team_access(report_id, auth.uid()))
);

-- checklists
DROP POLICY IF EXISTS "Users can view own checklists" ON public.checklists;
CREATE POLICY "Users can view own and team checklists"
ON public.checklists
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  OR public.has_team_access(report_id, auth.uid())
);

-- checklist_items (access via parent checklist → report ownership check)
DROP POLICY IF EXISTS "Users can view own checklist items" ON public.checklist_items;
CREATE POLICY "Users can view own and team checklist items"
ON public.checklist_items
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.checklists
    WHERE checklists.id = checklist_items.checklist_id
      AND (
        checklists.user_id = auth.uid()
        OR public.has_team_access(checklists.report_id, auth.uid())
      )
  )
);
