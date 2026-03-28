import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Download, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useTeamContext } from "@/contexts/TeamContext";
import { useAdminScope } from "@/hooks/useAdminScope";
import { getTeamDisplayName } from "@/lib/utils";
import * as XLSX from "xlsx";

interface GameWithTeam {
  id: string;
  team_id: string;
  opponent_name: string;
  game_date: string;
  is_home: boolean;
  location: string | null;
  status: string;
  home_score: number | null;
  away_score: number | null;
  notes: string | null;
  round_number: number | null;
  season_id: string | null;
}

const FixturesManagement = () => {
  const { teams, selectedTeamId, selectedClubId, selectedAssociationId } = useTeamContext();
  const { scopedTeamIds } = useAdminScope();
  const [games, setGames] = useState<GameWithTeam[]>([]);
  const [loading, setLoading] = useState(true);

  const teamIds = selectedTeamId
    ? [selectedTeamId]
    : scopedTeamIds.length > 0
    ? scopedTeamIds
    : [];

  useEffect(() => {
    const fetchGames = async () => {
      if (teamIds.length === 0) {
        setGames([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      const { data } = await supabase
        .from("games")
        .select("*")
        .in("team_id", teamIds)
        .order("game_date", { ascending: true });
      setGames((data as GameWithTeam[]) || []);
      setLoading(false);
    };
    fetchGames();
  }, [teamIds.join(",")]);

  const teamMap = new Map(teams.map((t) => [t.id, t]));

  const handleExport = () => {
    if (games.length === 0) return;

    const rows = games.map((g) => {
      const d = new Date(g.game_date);
      const team = teamMap.get(g.team_id);
      const teamName = team ? getTeamDisplayName(team) : g.team_id;
      return {
        Team: teamName,
        Round: g.round_number ?? "",
        Date: d.toLocaleDateString("en-AU", { day: "2-digit", month: "2-digit", year: "numeric" }),
        Day: d.toLocaleDateString("en-AU", { weekday: "short" }),
        Time: d.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" }),
        "Home/Away": g.is_home ? "Home" : "Away",
        Opponent: g.opponent_name,
        Location: g.location || "",
        Status: g.status,
        "Home Score": g.home_score ?? "",
        "Away Score": g.away_score ?? "",
        Notes: g.notes || "",
      };
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Fixtures");
    const dateStr = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `fixtures-bulk-${dateStr}.xlsx`);

    toast({ title: "Fixtures exported", description: `${games.length} games exported to XLSX.` });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl md:text-4xl text-foreground">
            FIXTURES MANAGEMENT
          </h1>
          <p className="text-muted-foreground mt-1">
            Export and manage fixtures across teams
          </p>
        </div>

        <Button
          onClick={handleExport}
          disabled={games.length === 0}
          className="gap-2"
        >
          <Download className="h-4 w-4" />
          Export All ({games.length})
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : games.length === 0 ? (
        <Card variant="ghost" className="text-center py-12">
          <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">
            {teamIds.length === 0
              ? "Select a scope using the header selectors to view fixtures."
              : "No fixtures found for the selected scope."}
          </p>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {games.length} Fixture{games.length !== 1 ? "s" : ""} Found
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Team</th>
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Rd</th>
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Date</th>
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">H/A</th>
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Opponent</th>
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Location</th>
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Status</th>
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Score</th>
                  </tr>
                </thead>
                <tbody>
                  {games.map((g) => {
                    const d = new Date(g.game_date);
                    const team = teamMap.get(g.team_id);
                    return (
                      <tr key={g.id} className="border-b border-border/50 hover:bg-muted/30">
                        <td className="py-2 px-3 text-foreground">
                          {team ? getTeamDisplayName(team) : "—"}
                        </td>
                        <td className="py-2 px-3 text-foreground">
                          {g.round_number ?? "—"}
                        </td>
                        <td className="py-2 px-3 text-foreground whitespace-nowrap">
                          {d.toLocaleDateString("en-AU", { day: "2-digit", month: "short" })}
                        </td>
                        <td className="py-2 px-3">
                          <Badge variant={g.is_home ? "default" : "outline"} className="text-xs">
                            {g.is_home ? "H" : "A"}
                          </Badge>
                        </td>
                        <td className="py-2 px-3 text-foreground">{g.opponent_name}</td>
                        <td className="py-2 px-3 text-muted-foreground truncate max-w-[150px]">
                          {g.location || "—"}
                        </td>
                        <td className="py-2 px-3">
                          <Badge variant="secondary" className="text-xs capitalize">
                            {g.status}
                          </Badge>
                        </td>
                        <td className="py-2 px-3 text-foreground">
                          {g.home_score !== null && g.away_score !== null
                            ? `${g.home_score}-${g.away_score}`
                            : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default FixturesManagement;
