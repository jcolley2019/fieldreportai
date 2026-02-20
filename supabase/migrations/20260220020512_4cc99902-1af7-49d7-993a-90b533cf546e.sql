
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  safe_display_name TEXT;
BEGIN
  safe_display_name := COALESCE(
    NULLIF(TRIM(new.raw_user_meta_data->>'display_name'), ''),
    'User'
  );
  IF length(safe_display_name) > 100 THEN
    safe_display_name := substring(safe_display_name, 1, 100);
  END IF;

  INSERT INTO public.profiles (id, display_name)
  VALUES (new.id, safe_display_name);
  RETURN new;
END;
$$;
