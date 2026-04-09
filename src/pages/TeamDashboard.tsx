import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import EntityDashboard from "@/components/entity/EntityDashboard";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

const TeamDashboard = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [entityName, setEntityName] = useState("");
  const [parentName, setParentName] = useState("");
  const [stats, setStats] = useState({ gamesPlayed: 0, goalsScored: 0 });
  const [upcomingGames, setUpcomingGames] = useState<any[]>([]);

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      setLoading(true);

      const { data: team } = await supabase
        .from("teams")
        .select("name, club_id")
        .eq("id", id)
        .single();

      if (!team) { navigate("/dashboard"); return; }
      setEntityName(team.name);

      const { data: club } = await supabase
        .from("clubs")
        .select("name")
        .eq("id", team.club_id)
        .single();
      setParentName(club?.name || "");

      // Stats
      const { data: completed } = await supabase
        .from("games")
        .select("home_score, away_score, is_home")
        .eq("team_id", id)
        .eq("status", "completed");

      const gamesPlayed = completed?.length || 0;
      const goalsScored = (completed || []).reduce((sum, g) => {
        return sum + (g.is_home ? (g.home_score || 0) : (g.away_score || 0));
      }, 0);
      setStats({ gamesPlayed, goalsScored });

      // Upcoming
      const { data: upcoming } = await supabase
        .from("games")
        .select("id, game_date, opponent_name, location, is_home, status, home_score, away_score")
        .eq("team_id", id)
        .eq("status", "scheduled")
        .gte("game_date", new Date().toISOString())
        .order("game_date", { ascending: true })
        .limit(5);

      setUpcomingGames(upcoming || []);
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
        entityName={entityName}
        entityType="team"
        parentName={parentName}
        stats={stats}
        upcomingGames={upcomingGames}
        loading={loading}
      />
    </div>
  );
};

export default TeamDashboard;
