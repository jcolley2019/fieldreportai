-- Add report_type column to reports table
ALTER TABLE public.reports 
ADD COLUMN report_type text DEFAULT 'daily' CHECK (report_type IN ('daily', 'weekly', 'site_survey'));

-- Add parent_report_id for linking daily reports to weekly reports
ALTER TABLE public.reports 
ADD COLUMN parent_report_id uuid REFERENCES public.reports(id) ON DELETE SET NULL;

-- Create index for efficient lookups
CREATE INDEX idx_reports_report_type ON public.reports(report_type);
CREATE INDEX idx_reports_parent_report_id ON public.reports(parent_report_id);