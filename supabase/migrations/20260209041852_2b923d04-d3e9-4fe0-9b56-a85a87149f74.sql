-- Add media_id column to notes table for linking notes to specific photos/videos
ALTER TABLE public.notes 
ADD COLUMN media_id uuid REFERENCES public.media(id) ON DELETE SET NULL;

-- Add media_id column to checklist_items table for linking checklist items to specific photos/videos
ALTER TABLE public.checklist_items 
ADD COLUMN media_id uuid DEFAULT NULL;

-- Add media_id column to tasks table for linking tasks to specific photos/videos
ALTER TABLE public.tasks 
ADD COLUMN media_id uuid REFERENCES public.media(id) ON DELETE SET NULL;

-- Create indexes for efficient lookups
CREATE INDEX idx_notes_media_id ON public.notes(media_id) WHERE media_id IS NOT NULL;
CREATE INDEX idx_checklist_items_media_id ON public.checklist_items(media_id) WHERE media_id IS NOT NULL;
CREATE INDEX idx_tasks_media_id ON public.tasks(media_id) WHERE media_id IS NOT NULL;