import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import EntityDashboard from "@/components/entity/EntityDashboard";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

const ClubDashboard = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [entity, setEntity] = useState<{ name: string; logo_url: string | null; abbreviation: string | null } | null>(null);
  const [parentName, setParentName] = useState("");
  const [stats, setStats] = useState({ gamesPlayed: 0, goalsScored: 0 });
  const [upcomingGames, setUpcomingGames] = useState<any[]>([]);

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      setLoading(true);

      const { data: club } = await supabase
        .from("clubs")
        .select("name, logo_url, abbreviation, association_id")
        .eq("id", id)
        .single();

      if (!club) { navigate("/admin"); return; }
      setEntity(club);

      // Parent association name
      const { data: assoc } = await supabase
        .from("associations")
        .select("name")
        .eq("id", club.association_id)
        .single();
      setParentName(assoc?.name || "");

      // Teams for this club
      const { data: teams } = await supabase.from("teams").select("id, name").eq("club_id", id);
      const teamIds = teams?.map((t) => t.id) || [];
      const teamMap = Object.fromEntries((teams || []).map((t) => [t.id, t.name]));

      if (teamIds.length === 0) {
        setStats({ gamesPlayed: 0, goalsScored: 0 });
        setUpcomingGames([]);
        setLoading(false);
        return;
      }

      const { data: completed } = await supabase
        .from("games")
        .select("home_score, away_score, is_home")
        .in("team_id", teamIds)
        .eq("status", "completed");

      const gamesPlayed = completed?.length || 0;
      const goalsScored = (completed || []).reduce((sum, g) => {
        return sum + (g.is_home ? (g.home_score || 0) : (g.away_score || 0));
      }, 0);
      setStats({ gamesPlayed, goalsScored });

      const { data: upcoming } = await supabase
        .from("games")
        .select("id, game_date, opponent_name, location, is_home, status, home_score, away_score, team_id")
        .in("team_id", teamIds)
        .eq("status", "scheduled")
        .gte("game_date", new Date().toISOString())
        .order("game_date", { ascending: true })
        .limit(5);

      setUpcomingGames(
        (upcoming || []).map((g) => ({ ...g, team_name: teamMap[g.team_id] }))
      );
      setLoading(false);
    };
    load();
  }, [id, navigate]);

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-1">
        <ArrowLeft className="h-4 w-4" /> Back
      </Button>
      <EntityDashboard
        entityName={entity?.name || ""}
        entityType="club"
        logoUrl={entity?.logo_url}
        abbreviation={entity?.abbreviation}
        parentName={parentName}
        stats={stats}
        upcomingGames={upcomingGames}
        loading={loading}
      />
    </div>
  );
};

export default ClubDashboard;
