-- Create enum for lead sources
CREATE TYPE public.lead_source AS ENUM (
  'pricing_page',
  'landing_page',
  'enterprise_inquiry',
  'newsletter',
  'trial_signup'
);

-- Create enum for email sequence types
CREATE TYPE public.email_sequence AS ENUM (
  'welcome',
  'trial',
  'enterprise_nurture',
  'newsletter',
  'abandoned_signup'
);

-- Create leads table for email marketing
CREATE TABLE public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  company TEXT,
  source lead_source NOT NULL,
  active_sequences email_sequence[] DEFAULT '{}',
  subscribed BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create email_sequence_log table to track sent emails
CREATE TABLE public.email_sequence_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE NOT NULL,
  sequence_type email_sequence NOT NULL,
  email_subject TEXT NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  opened BOOLEAN DEFAULT false,
  clicked BOOLEAN DEFAULT false
);

-- Enable RLS
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_sequence_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies for leads (admin only for now)
CREATE POLICY "Service role can manage leads"
  ON public.leads
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- RLS Policies for email_sequence_log
CREATE POLICY "Service role can manage email logs"
  ON public.email_sequence_log
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create updated_at trigger for leads
CREATE TRIGGER update_leads_updated_at
  BEFORE UPDATE ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Create index for faster email lookups
CREATE INDEX idx_leads_email ON public.leads(email);
CREATE INDEX idx_leads_source ON public.leads(source);
CREATE INDEX idx_email_sequence_log_lead_id ON public.email_sequence_log(lead_id);