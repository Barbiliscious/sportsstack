
-- Fix the security definer view warning by changing the view owner to authenticated
-- and ensuring it runs in the context of the querying user (SECURITY INVOKER is default for views)
DROP VIEW IF EXISTS public.teammate_profiles;

-- Recreate as a plain view (SECURITY INVOKER by default) with security_barrier
CREATE VIEW public.teammate_profiles WITH (security_barrier = true) AS
  SELECT p.id, p.first_name, p.last_name, p.avatar_url, p.gender
  FROM public.profiles p
  WHERE p.id IN (
    SELECT tm.user_id FROM public.team_memberships tm
    JOIN public.team_memberships my_tm ON my_tm.team_id = tm.team_id
    WHERE my_tm.user_id = auth.uid()
      AND my_tm.status = 'APPROVED'
      AND tm.status = 'APPROVED'
  );

-- Explicitly set security_invoker to true to avoid the SECURITY DEFINER warning
ALTER VIEW public.teammate_profiles SET (security_invoker = true);

REVOKE ALL ON public.teammate_profiles FROM anon;
GRANT SELECT ON public.teammate_profiles TO authenticated;
