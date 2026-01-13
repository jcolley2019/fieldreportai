-- Create AI metrics table for tracking usage and fallback rates
CREATE TABLE public.ai_metrics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  function_name TEXT NOT NULL,
  primary_model TEXT NOT NULL,
  model_used TEXT NOT NULL,
  used_fallback BOOLEAN NOT NULL DEFAULT false,
  latency_ms INTEGER,
  status TEXT NOT NULL DEFAULT 'success',
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for querying by function and date
CREATE INDEX idx_ai_metrics_function_created ON public.ai_metrics (function_name, created_at DESC);
CREATE INDEX idx_ai_metrics_fallback ON public.ai_metrics (used_fallback, created_at DESC);

-- Enable RLS
ALTER TABLE public.ai_metrics ENABLE ROW LEVEL SECURITY;

-- Only allow service role to insert (edge functions use service role)
CREATE POLICY "Service role can insert metrics"
ON public.ai_metrics
FOR INSERT
TO service_role
WITH CHECK (true);

-- Admins can view all metrics
CREATE POLICY "Admins can view metrics"
ON public.ai_metrics
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Add comment for documentation
COMMENT ON TABLE public.ai_metrics IS 'Tracks AI function usage, model selection, and fallback events. Logging controlled by LOG_AI_METRICS env var.';