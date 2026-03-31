
-- 1. Create teammate_profiles view with restricted columns only
CREATE VIEW public.teammate_profiles
WITH (security_invoker = on) AS
SELECT p.id, p.first_name, p.last_name, p.avatar_url, p.gender
FROM public.profiles p
WHERE p.id IN (
  SELECT tm2.user_id 
  FROM public.team_memberships tm1
  JOIN public.team_memberships tm2 ON tm1.team_id = tm2.team_id
  WHERE tm1.user_id = auth.uid()
    AND tm1.status = 'APPROVED' 
    AND tm2.status = 'APPROVED'
);

-- Drop the overly broad teammate policy that exposes all profile columns
DROP POLICY IF EXISTS "Team members can view teammate profiles" ON public.profiles;

-- 2. Create scoped role granting function
CREATE OR REPLACE FUNCTION public.can_grant_role(
  _grantor_id uuid,
  _target_role app_role,
  _target_association_id uuid,
  _target_club_id uuid,
  _target_team_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    _grantor_id IS DISTINCT FROM NULL
    AND (
      EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = _grantor_id AND role = 'SUPER_ADMIN'
      )
      OR
      (
        _target_role IN ('CLUB_ADMIN', 'TEAM_MANAGER', 'COACH', 'PLAYER')
        AND EXISTS (
          SELECT 1 FROM public.user_roles
          WHERE user_id = _grantor_id
            AND role = 'ASSOCIATION_ADMIN'
            AND association_id IS NOT NULL
            AND (
              association_id = _target_association_id
              OR association_id = (SELECT c.association_id FROM public.clubs c WHERE c.id = _target_club_id)
              OR association_id = (
                SELECT c.association_id FROM public.teams t 
                JOIN public.clubs c ON c.id = t.club_id 
                WHERE t.id = _target_team_id
              )
            )
        )
      )
      OR
      (
        _target_role IN ('TEAM_MANAGER', 'COACH', 'PLAYER')
        AND EXISTS (
          SELECT 1 FROM public.user_roles
          WHERE user_id = _grantor_id
            AND role = 'CLUB_ADMIN'
            AND club_id IS NOT NULL
            AND (
              club_id = _target_club_id
              OR club_id = (SELECT t.club_id FROM public.teams t WHERE t.id = _target_team_id)
            )
        )
      )
    );
$$;

-- Drop old permissive INSERT/UPDATE policies on user_roles
DROP POLICY IF EXISTS "Admins can insert roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can update roles" ON public.user_roles;

-- Create scoped INSERT policy
CREATE POLICY "Admins can insert scoped roles" ON public.user_roles
FOR INSERT TO authenticated
WITH CHECK (
  public.can_grant_role(auth.uid(), role, association_id, club_id, team_id)
);

-- Create scoped UPDATE policy
CREATE POLICY "Admins can update scoped roles" ON public.user_roles
FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'SUPER_ADMIN') 
  OR has_role(auth.uid(), 'ASSOCIATION_ADMIN') 
  OR has_role(auth.uid(), 'CLUB_ADMIN')
)
WITH CHECK (
  public.can_grant_role(auth.uid(), role, association_id, club_id, team_id)
);

-- 3. Fix notifications INSERT policy to use authenticated instead of public
DROP POLICY IF EXISTS "System and admins can create notifications" ON public.notifications;
CREATE POLICY "Authenticated users and admins can create notifications" ON public.notifications
FOR INSERT TO authenticated
WITH CHECK (
  (user_id = auth.uid())
  OR has_role(auth.uid(), 'SUPER_ADMIN')
  OR has_role(auth.uid(), 'COACH')
  OR has_role(auth.uid(), 'CLUB_ADMIN')
  OR has_role(auth.uid(), 'TEAM_MANAGER')
);
