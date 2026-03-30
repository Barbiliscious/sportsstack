
-- Step 1: Create a security definer function to check if a profile user is in admin's scope
CREATE OR REPLACE FUNCTION public.is_profile_in_admin_scope(_profile_user_id uuid, _admin_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    -- SUPER_ADMIN can see all
    SELECT 1 FROM public.user_roles
    WHERE user_id = _admin_user_id AND role = 'SUPER_ADMIN'
  )
  OR EXISTS (
    -- ASSOCIATION_ADMIN: target user must be in a team belonging to a club in admin's association
    SELECT 1
    FROM public.user_roles ar
    JOIN public.clubs c ON c.association_id = ar.association_id
    JOIN public.teams t ON t.club_id = c.id
    JOIN public.team_memberships tm ON tm.team_id = t.id AND tm.user_id = _profile_user_id
    WHERE ar.user_id = _admin_user_id
      AND ar.role = 'ASSOCIATION_ADMIN'
      AND ar.association_id IS NOT NULL
  )
  OR EXISTS (
    -- CLUB_ADMIN: target user must be in a team belonging to admin's club
    SELECT 1
    FROM public.user_roles ar
    JOIN public.teams t ON t.club_id = ar.club_id
    JOIN public.team_memberships tm ON tm.team_id = t.id AND tm.user_id = _profile_user_id
    WHERE ar.user_id = _admin_user_id
      AND ar.role = 'CLUB_ADMIN'
      AND ar.club_id IS NOT NULL
  )
  OR EXISTS (
    -- COACH/TEAM_MANAGER: target user must be on a team the admin manages
    SELECT 1
    FROM public.user_roles ar
    JOIN public.team_memberships tm ON tm.team_id = ar.team_id AND tm.user_id = _profile_user_id
    WHERE ar.user_id = _admin_user_id
      AND ar.role IN ('COACH', 'TEAM_MANAGER')
      AND ar.team_id IS NOT NULL
  );
$$;

-- Step 2: Drop the overly broad policy
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

-- Step 3: Create scoped admin profile access policy
CREATE POLICY "Admins can view scoped profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  public.is_profile_in_admin_scope(id, auth.uid())
);

-- Step 4: Add teammate visibility policy (approved members can see teammates)
CREATE POLICY "Team members can view teammate profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  id IN (
    SELECT tm2.user_id
    FROM public.team_memberships tm1
    JOIN public.team_memberships tm2 ON tm1.team_id = tm2.team_id
    WHERE tm1.user_id = auth.uid()
      AND tm1.status = 'APPROVED'
      AND tm2.status = 'APPROVED'
  )
);
