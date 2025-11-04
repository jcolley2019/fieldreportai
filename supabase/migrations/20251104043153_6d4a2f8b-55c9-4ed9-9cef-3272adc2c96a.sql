-- Drop the overly permissive policy that allows all authenticated users to view all profiles
DROP POLICY IF EXISTS "Authenticated users can view profiles" ON public.profiles;

-- Create a secure policy that only allows users to view their own profile
CREATE POLICY "Users can view own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);