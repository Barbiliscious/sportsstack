import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface Association {
  id: string;
  name: string;
  abbreviation: string | null;
  logo_url: string | null;
}

interface Club {
  id: string;
  association_id: string;
  name: string;
  abbreviation: string | null;
  logo_url: string | null;
  home_ground: string | null;
  primary_colour: string | null;
  secondary_colour: string | null;
  banner_url: string | null;
}

interface Team {
  id: string;
  club_id: string;
  name: string;
  age_group: string | null;
  gender: string | null;
  division: string | null;
}

interface TeamContextType {
  associations: Association[];
  clubs: Club[];
  teams: Team[];
  selectedAssociationId: string;
  selectedClubId: string;
  selectedTeamId: string;
  selectedDivision: string;
  setSelectedAssociationId: (id: string) => void;
  setSelectedClubId: (id: string) => void;
  setSelectedTeamId: (id: string) => void;
  setSelectedDivision: (d: string) => void;
  filteredClubs: Club[];
  filteredTeams: Team[];
  filteredDivisions: string[];
  selectedAssociation: Association | undefined;
  selectedClub: Club | undefined;
  selectedTeam: Team | undefined;
  loading: boolean;
}

const TeamContext = createContext<TeamContextType | undefined>(undefined);

export function TeamProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [associations, setAssociations] = useState<Association[]>([]);
  const [clubs, setClubs] = useState<Club[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedAssociationId, setSelectedAssociationId] = useState("");
  const [selectedClubId, setSelectedClubId] = useState("");
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [selectedDivision, setSelectedDivision] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const [assocRes, clubRes, teamRes] = await Promise.all([
        supabase.from("associations").select("*").order("name"),
        supabase.from("clubs").select("*").order("name"),
        supabase.from("teams").select("*").order("name"),
      ]);

      const assocs = assocRes.data || [];
      const allClubs = clubRes.data || [];
      const allTeams = teamRes.data || [];

      setAssociations(assocs);
      setClubs(allClubs);
      setTeams(allTeams);

      // No auto-select - selectors start empty, mode determines what's shown

      setLoading(false);
    };

    fetchData();
  }, [user]);

  const filteredClubs = clubs.filter(c => c.association_id === selectedAssociationId);
  const filteredTeams = teams.filter(t => t.club_id === selectedClubId);

  const handleAssociationChange = (id: string) => {
    setSelectedAssociationId(id);
    setSelectedClubId("");
    setSelectedTeamId("");
  };

  const handleClubChange = (id: string) => {
    setSelectedClubId(id);
    setSelectedTeamId("");
  };

  const selectedAssociation = associations.find(a => a.id === selectedAssociationId);
  const selectedClub = clubs.find(c => c.id === selectedClubId);
  const selectedTeam = teams.find(t => t.id === selectedTeamId);

  return (
    <TeamContext.Provider
      value={{
        associations,
        clubs,
        teams,
        selectedAssociationId,
        selectedClubId,
        selectedTeamId,
        setSelectedAssociationId: handleAssociationChange,
        setSelectedClubId: handleClubChange,
        setSelectedTeamId,
        filteredClubs,
        filteredTeams,
        selectedAssociation,
        selectedClub,
        selectedTeam,
        loading,
      }}
    >
      {children}
    </TeamContext.Provider>
  );
}

export function useTeamContext() {
  const context = useContext(TeamContext);
  if (!context) {
    throw new Error("useTeamContext must be used within TeamProvider");
  }
  return context;
}
