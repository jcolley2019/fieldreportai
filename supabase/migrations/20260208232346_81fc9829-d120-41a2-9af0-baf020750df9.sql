-- Create table for public share links
CREATE TABLE public.project_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid REFERENCES public.reports(id) ON DELETE CASCADE NOT NULL,
  user_id uuid NOT NULL,
  share_token text UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + interval '30 days'),
  allow_download boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  revoked_at timestamp with time zone DEFAULT NULL
);

-- Create table for team member access (login required)
CREATE TABLE public.team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid REFERENCES public.reports(id) ON DELETE CASCADE NOT NULL,
  owner_id uuid NOT NULL,
  member_email text NOT NULL,
  member_user_id uuid DEFAULT NULL,
  role text NOT NULL DEFAULT 'viewer' CHECK (role IN ('viewer', 'editor')),
  invited_at timestamp with time zone DEFAULT now(),
  accepted_at timestamp with time zone DEFAULT NULL,
  UNIQUE(report_id, member_email)
);

-- Enable RLS
ALTER TABLE public.project_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

-- RLS policies for project_shares (owner can manage their shares)
CREATE POLICY "Users can view own shares"
  ON public.project_shares FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own shares"
  ON public.project_shares FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own shares"
  ON public.project_shares FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own shares"
  ON public.project_shares FOR DELETE
  USING (auth.uid() = user_id);

-- RLS policies for team_members
CREATE POLICY "Owners can manage team members"
  ON public.team_members FOR ALL
  USING (auth.uid() = owner_id);

CREATE POLICY "Team members can view their invites"
  ON public.team_members FOR SELECT
  USING (auth.uid() = member_user_id OR member_email = (SELECT email FROM auth.users WHERE id = auth.uid()));

-- Create function to check if user has team access to a project
CREATE OR REPLACE FUNCTION public.has_team_access(p_report_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_members
    WHERE report_id = p_report_id
      AND (member_user_id = p_user_id OR member_email = (SELECT email FROM auth.users WHERE id = p_user_id))
      AND accepted_at IS NOT NULL
  )
$$;

-- Add index for fast token lookups
CREATE INDEX idx_project_shares_token ON public.project_shares(share_token) WHERE revoked_at IS NULL;
CREATE INDEX idx_team_members_email ON public.team_members(member_email);
CREATE INDEX idx_team_members_user_id ON public.team_members(member_user_id) WHERE member_user_id IS NOT NULL;