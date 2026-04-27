-- Phase 1b: Update RLS policies to use SUPER_ADMIN and assign role

-- Update associations RLS - add SUPER_ADMIN
DROP POLICY IF EXISTS "Association admins can manage associations" ON associations;
CREATE POLICY "Admins can manage associations"
ON associations FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'SUPER_ADMIN') OR has_role(auth.uid(), 'ASSOCIATION_ADMIN'));

-- Update clubs RLS - add SUPER_ADMIN
DROP POLICY IF EXISTS "Club admins can manage their clubs" ON clubs;
CREATE POLICY "Admins can manage clubs"
ON clubs FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'SUPER_ADMIN') OR has_role(auth.uid(), 'ASSOCIATION_ADMIN') OR has_role(auth.uid(), 'CLUB_ADMIN'));

-- Update teams RLS - add SUPER_ADMIN
DROP POLICY IF EXISTS "Club admins and coaches can manage teams" ON teams;
CREATE POLICY "Admins can manage teams"
ON teams FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'SUPER_ADMIN') OR has_role(auth.uid(), 'ASSOCIATION_ADMIN') OR has_role(auth.uid(), 'CLUB_ADMIN') OR has_role(auth.uid(), 'TEAM_MANAGER'));

-- Update games RLS - add SUPER_ADMIN
DROP POLICY IF EXISTS "Coaches and admins can manage games" ON games;
CREATE POLICY "Admins and coaches can manage games"
ON games FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'SUPER_ADMIN') OR has_role(auth.uid(), 'ASSOCIATION_ADMIN') OR has_role(auth.uid(), 'CLUB_ADMIN') OR has_role(auth.uid(), 'COACH') OR has_role(auth.uid(), 'TEAM_MANAGER'));

DROP POLICY IF EXISTS "Team members can view their games" ON games;
CREATE POLICY "Team members can view their games"
ON games FOR SELECT
TO authenticated
USING (
  team_id IN (
    SELECT team_id FROM team_memberships 
    WHERE user_id = auth.uid() AND status = 'APPROVED'
  ) 
  OR has_role(auth.uid(), 'SUPER_ADMIN')
  OR has_role(auth.uid(), 'ASSOCIATION_ADMIN')
  OR has_role(auth.uid(), 'CLUB_ADMIN')
  OR has_role(auth.uid(), 'COACH')
);

-- Update lineups RLS - add SUPER_ADMIN
DROP POLICY IF EXISTS "Coaches can manage lineups" ON lineups;
CREATE POLICY "Admins and coaches can manage lineups"
ON lineups FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'SUPER_ADMIN') OR has_role(auth.uid(), 'ASSOCIATION_ADMIN') OR has_role(auth.uid(), 'CLUB_ADMIN') OR has_role(auth.uid(), 'COACH') OR has_role(auth.uid(), 'TEAM_MANAGER'));

DROP POLICY IF EXISTS "Team members can view lineups" ON lineups;
CREATE POLICY "Team members can view lineups"
ON lineups FOR SELECT
TO authenticated
USING (
  game_id IN (
    SELECT g.id FROM games g
    JOIN team_memberships tm ON tm.team_id = g.team_id
    WHERE tm.user_id = auth.uid() AND tm.status = 'APPROVED'
  )
  OR has_role(auth.uid(), 'SUPER_ADMIN')
  OR has_role(auth.uid(), 'ASSOCIATION_ADMIN')
  OR has_role(auth.uid(), 'CLUB_ADMIN')
  OR has_role(auth.uid(), 'COACH')
);

-- Update team_memberships RLS - add SUPER_ADMIN
DROP POLICY IF EXISTS "Admins and coaches can manage memberships" ON team_memberships;
CREATE POLICY "Admins and coaches can manage memberships"
ON team_memberships FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'SUPER_ADMIN') OR has_role(auth.uid(), 'ASSOCIATION_ADMIN') OR has_role(auth.uid(), 'CLUB_ADMIN') OR has_role(auth.uid(), 'COACH') OR has_role(auth.uid(), 'TEAM_MANAGER'));

DROP POLICY IF EXISTS "Admins and coaches can view all memberships" ON team_memberships;
CREATE POLICY "Admins and coaches can view all memberships"
ON team_memberships FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'SUPER_ADMIN') OR has_role(auth.uid(), 'ASSOCIATION_ADMIN') OR has_role(auth.uid(), 'CLUB_ADMIN') OR has_role(auth.uid(), 'COACH') OR has_role(auth.uid(), 'TEAM_MANAGER'));

DROP POLICY IF EXISTS "Admins can delete memberships" ON team_memberships;
CREATE POLICY "Admins can delete memberships"
ON team_memberships FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'SUPER_ADMIN') OR has_role(auth.uid(), 'ASSOCIATION_ADMIN') OR has_role(auth.uid(), 'CLUB_ADMIN'));

-- Drop the old insert policy and create new one
DROP POLICY IF EXISTS "Users can request to join teams" ON team_memberships;
CREATE POLICY "Users and admins can add memberships"
ON team_memberships FOR INSERT
TO authenticated
WITH CHECK (
  (user_id = auth.uid() AND status = 'PENDING')
  OR has_role(auth.uid(), 'SUPER_ADMIN')
  OR has_role(auth.uid(), 'ASSOCIATION_ADMIN')
  OR has_role(auth.uid(), 'CLUB_ADMIN')
  OR has_role(auth.uid(), 'COACH')
  OR has_role(auth.uid(), 'TEAM_MANAGER')
);

-- Update user_roles RLS - add SUPER_ADMIN
DROP POLICY IF EXISTS "Admins can delete roles" ON user_roles;
CREATE POLICY "Admins can delete roles"
ON user_roles FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'SUPER_ADMIN') OR has_role(auth.uid(), 'ASSOCIATION_ADMIN') OR has_role(auth.uid(), 'CLUB_ADMIN'));

DROP POLICY IF EXISTS "Admins can insert roles" ON user_roles;
CREATE POLICY "Admins can insert roles"
ON user_roles FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'SUPER_ADMIN') OR has_role(auth.uid(), 'ASSOCIATION_ADMIN') OR has_role(auth.uid(), 'CLUB_ADMIN'));

DROP POLICY IF EXISTS "Admins can update roles" ON user_roles;
CREATE POLICY "Admins can update roles"
ON user_roles FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'SUPER_ADMIN') OR has_role(auth.uid(), 'ASSOCIATION_ADMIN') OR has_role(auth.uid(), 'CLUB_ADMIN'));

DROP POLICY IF EXISTS "Admins can view all roles" ON user_roles;
CREATE POLICY "Admins can view all roles"
ON user_roles FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'SUPER_ADMIN') OR has_role(auth.uid(), 'ASSOCIATION_ADMIN') OR has_role(auth.uid(), 'CLUB_ADMIN'));

-- Update profiles RLS - add policy for admins to view all profiles
CREATE POLICY "Admins can view all profiles"
ON profiles FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'SUPER_ADMIN') OR has_role(auth.uid(), 'ASSOCIATION_ADMIN') OR has_role(auth.uid(), 'CLUB_ADMIN') OR has_role(auth.uid(), 'COACH') OR has_role(auth.uid(), 'TEAM_MANAGER'));

-- Update primary_change_requests RLS - add SUPER_ADMIN
DROP POLICY IF EXISTS "Admins and coaches can manage primary change requests" ON primary_change_requests;
CREATE POLICY "Admins and coaches can manage primary change requests"
ON primary_change_requests FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'SUPER_ADMIN') OR has_role(auth.uid(), 'ASSOCIATION_ADMIN') OR has_role(auth.uid(), 'CLUB_ADMIN') OR has_role(auth.uid(), 'COACH') OR has_role(auth.uid(), 'TEAM_MANAGER'));

-- Assign SUPER_ADMIN role to Aaron Mullane
-- INSERT INTO user_roles (user_id, role) 
-- VALUES ('8e30a71e-7a8a-4eda-a51a-19223fa3fc0b', 'SUPER_ADMIN');