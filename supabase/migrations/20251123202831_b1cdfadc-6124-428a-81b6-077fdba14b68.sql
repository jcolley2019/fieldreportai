-- Add email template customization fields to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS email_template_color TEXT DEFAULT '#007bff',
ADD COLUMN IF NOT EXISTS email_template_message TEXT;