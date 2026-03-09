import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

interface ScopedRole {
  role: AppRole;
  association_id: string | null;
  club_id: string | null;
  team_id: string | null;
}

interface AdminScope {
  loading: boolean;
  isSuperAdmin: boolean;
  isAnyAdmin: boolean;
  scopedRoles: ScopedRole[];
  scopedAssociationIds: string[];
  scopedClubIds: string[];
  scopedTeamIds: string[];
  canManageAssociation: (id: string) => boolean;
  canManageClub: (id: string) => boolean;
  canManageTeam: (id: string) => boolean;
  highestScopedRole: AppRole | null;
  refetch: () => Promise<void>;
}

const ADMIN_ROLES: AppRole[] = ["SUPER_ADMIN", "ASSOCIATION_ADMIN", "CLUB_ADMIN", "TEAM_MANAGER", "COACH"];

export function useAdminScope(): AdminScope {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [scopedRoles, setScopedRoles] = useState<ScopedRole[]>([]);
  const [allClubs, setAllClubs] = useState<{ id: string; association_id: string }[]>([]);
  const [allTeams, setAllTeams] = useState<{ id: string; club_id: string }[]>([]);

  const fetchScope = useCallback(async () => {
    if (!user) {
      setScopedRoles([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    // Fetch user's roles with scope columns + hierarchy data in parallel
    const [rolesRes, clubsRes, teamsRes] = await Promise.all([
      supabase
        .from("user_roles")
        .select("role, association_id, club_id, team_id")
        .eq("user_id", user.id),
      supabase.from("clubs").select("id, association_id"),
      supabase.from("teams").select("id, club_id"),
    ]);

    setScopedRoles(
      (rolesRes.data || []).map((r) => ({
        role: r.role,
        association_id: r.association_id,
        club_id: r.club_id,
        team_id: r.team_id,
      }))
    );
    setAllClubs(clubsRes.data || []);
    setAllTeams(teamsRes.data || []);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    fetchScope();
  }, [fetchScope]);

  const isSuperAdmin = scopedRoles.some((r) => r.role === "SUPER_ADMIN");
  const isAnyAdmin = scopedRoles.some((r) => ADMIN_ROLES.includes(r.role));

  // Build scoped IDs
  const scopedAssociationIds: string[] = [];
  const scopedClubIds: string[] = [];
  const scopedTeamIds: string[] = [];

  if (!loading) {
    if (isSuperAdmin) {
      // Super admin sees all - we don't populate specific IDs, callers check isSuperAdmin
    } else {
      for (const sr of scopedRoles) {
        if (sr.role === "ASSOCIATION_ADMIN" && sr.association_id) {
          if (!scopedAssociationIds.includes(sr.association_id)) {
            scopedAssociationIds.push(sr.association_id);
          }
          // Add all clubs under this association
          for (const club of allClubs) {
            if (club.association_id === sr.association_id && !scopedClubIds.includes(club.id)) {
              scopedClubIds.push(club.id);
            }
          }
          // Add all teams under those clubs
          for (const team of allTeams) {
            const club = allClubs.find((c) => c.id === team.club_id);
            if (club && club.association_id === sr.association_id && !scopedTeamIds.includes(team.id)) {
              scopedTeamIds.push(team.id);
            }
          }
        }
        if (sr.role === "CLUB_ADMIN" && sr.club_id) {
          if (!scopedClubIds.includes(sr.club_id)) {
            scopedClubIds.push(sr.club_id);
          }
          // Add all teams under this club
          for (const team of allTeams) {
            if (team.club_id === sr.club_id && !scopedTeamIds.includes(team.id)) {
              scopedTeamIds.push(team.id);
            }
          }
        }
        if ((sr.role === "TEAM_MANAGER" || sr.role === "COACH") && sr.team_id) {
          if (!scopedTeamIds.includes(sr.team_id)) {
            scopedTeamIds.push(sr.team_id);
          }
        }
      }
    }
  }

  const canManageAssociation = (id: string) => isSuperAdmin || scopedAssociationIds.includes(id);
  const canManageClub = (id: string) => isSuperAdmin || scopedClubIds.includes(id);
  const canManageTeam = (id: string) => isSuperAdmin || scopedTeamIds.includes(id);

  const ROLE_HIERARCHY: AppRole[] = ["SUPER_ADMIN", "ASSOCIATION_ADMIN", "CLUB_ADMIN", "TEAM_MANAGER", "COACH", "PLAYER"];
  const highestScopedRole = scopedRoles.length > 0
    ? ROLE_HIERARCHY.find((r) => scopedRoles.some((sr) => sr.role === r)) || null
    : null;

  return {
    loading,
    isSuperAdmin,
    isAnyAdmin,
    scopedRoles,
    scopedAssociationIds,
    scopedClubIds,
    scopedTeamIds,
    canManageAssociation,
    canManageClub,
    canManageTeam,
    highestScopedRole,
    refetch: fetchScope,
  };
}
