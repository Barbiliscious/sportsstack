import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Download, Calendar, Upload, Pencil, Trash2, Plus, Save, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
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
  const navigate = useNavigate();
  const { toast } = useToast();
  const { teams, selectedTeamId, selectedClubId, selectedAssociationId } = useTeamContext();
  const { scopedTeamIds } = useAdminScope();
  const [games, setGames] = useState<GameWithTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<GameWithTeam>>({});
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [addForm, setAddForm] = useState({ team_id: "", opponent_name: "", game_date: "", game_time: "", location: "", round_number: "", status: "scheduled" });
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterRound, setFilterRound] = useState("");

  const teamIds = selectedTeamId
    ? [selectedTeamId]
    : scopedTeamIds.length > 0
    ? scopedTeamIds
    : [];

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

  useEffect(() => {
    fetchGames();
  }, [teamIds.join(",")]);

  const teamMap = new Map(teams.map((t) => [t.id, t]));

  const handleExport = () => {
    if (games.length === 0) return;
    const rows = games.map((g) => {
      const d = new Date(g.game_date);
      const team = teamMap.get(g.team_id);
      return {
        Team: team ? getTeamDisplayName(team) : g.team_id,
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
    XLSX.writeFile(wb, `fixtures-export-${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast({ title: "Exported", description: `${games.length} fixtures exported.` });
  };

  const startEdit = (g: GameWithTeam) => {
    setEditingId(g.id);
    setEditForm({
      opponent_name: g.opponent_name,
      location: g.location,
      status: g.status,
      home_score: g.home_score,
      away_score: g.away_score,
      round_number: g.round_number,
      notes: g.notes,
    });
  };

  const saveEdit = async () => {
    if (!editingId) return;
    const { error } = await supabase.from("games").update({
      opponent_name: editForm.opponent_name,
      location: editForm.location || null,
      status: editForm.status,
      home_score: editForm.home_score ?? null,
      away_score: editForm.away_score ?? null,
      round_number: editForm.round_number ?? null,
      notes: editForm.notes || null,
    }).eq("id", editingId);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Updated", description: "Fixture updated successfully." });
      setEditingId(null);
      fetchGames();
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.from("games").delete().eq("id", deleteTarget);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Deleted", description: "Fixture deleted." });
      fetchGames();
    }
    setDeleteDialogOpen(false);
    setDeleteTarget(null);
  };

  const handleAddFixture = async () => {
    if (!addForm.team_id || !addForm.opponent_name || !addForm.game_date) {
      toast({ title: "Error", description: "Team, opponent and date are required.", variant: "destructive" });
      return;
    }
    const gameDate = addForm.game_time ? `${addForm.game_date}T${addForm.game_time}:00` : `${addForm.game_date}T00:00:00`;
    const { error } = await supabase.from("games").insert({
      team_id: addForm.team_id,
      opponent_name: addForm.opponent_name,
      game_date: gameDate,
      is_home: true,
      location: addForm.location || null,
      round_number: addForm.round_number ? parseInt(addForm.round_number) : null,
      status: addForm.status,
    });
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Created", description: "Fixture added." });
    setAddDialogOpen(false);
    setAddForm({ team_id: "", opponent_name: "", game_date: "", game_time: "", location: "", round_number: "", status: "scheduled" });
    fetchGames();
  };

  // Filter games
  let displayGames = games;
  if (filterStatus !== "all") displayGames = displayGames.filter((g) => g.status === filterStatus);
  if (filterRound) displayGames = displayGames.filter((g) => g.round_number !== null && String(g.round_number) === filterRound);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl md:text-4xl text-foreground">
            FIXTURES MANAGEMENT
          </h1>
          <p className="text-muted-foreground mt-1">
            Import, edit, and manage fixtures across teams
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => navigate("/admin/fixture-import")} className="gap-2">
            <Upload className="h-4 w-4" />
            Import
          </Button>
          <Button variant="outline" onClick={handleExport} disabled={games.length === 0} className="gap-2">
            <Download className="h-4 w-4" />
            Export ({games.length})
          </Button>
          <Button onClick={() => setAddDialogOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Add
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <Label>Status:</Label>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="scheduled">Scheduled</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
              <SelectItem value="postponed">Postponed</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Label>Round:</Label>
          <Input className="w-20 h-9" type="number" placeholder="All" value={filterRound} onChange={(e) => setFilterRound(e.target.value)} />
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full" />)}
        </div>
      ) : displayGames.length === 0 ? (
        <Card variant="ghost" className="text-center py-12">
          <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">
            {teamIds.length === 0
              ? "Select a scope using the header selectors to view fixtures."
              : "No fixtures found. Import fixtures or add one manually."}
          </p>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {games.length} Fixture{games.length !== 1 ? "s" : ""}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Team</TableHead>
                    <TableHead>Rd</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>H/A</TableHead>
                    <TableHead>Opponent</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {games.map((g) => {
                    const d = new Date(g.game_date);
                    const team = teamMap.get(g.team_id);
                    const isEditing = editingId === g.id;

                    return (
                      <TableRow key={g.id}>
                        <TableCell className="text-foreground">
                          {team ? getTeamDisplayName(team) : "—"}
                        </TableCell>
                        <TableCell>
                          {isEditing ? (
                            <Input className="h-7 w-14 text-xs" type="number" value={editForm.round_number ?? ""} onChange={(e) => setEditForm((p) => ({ ...p, round_number: e.target.value ? parseInt(e.target.value) : null }))} />
                          ) : (
                            g.round_number ?? "—"
                          )}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-foreground">
                          {d.toLocaleDateString("en-AU", { day: "2-digit", month: "short" })}
                        </TableCell>
                        <TableCell>
                          <Badge variant={g.is_home ? "default" : "outline"} className="text-xs">
                            {g.is_home ? "H" : "A"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {isEditing ? (
                            <Input className="h-7 w-32 text-xs" value={editForm.opponent_name || ""} onChange={(e) => setEditForm((p) => ({ ...p, opponent_name: e.target.value }))} />
                          ) : (
                            g.opponent_name
                          )}
                        </TableCell>
                        <TableCell>
                          {isEditing ? (
                            <Input className="h-7 w-32 text-xs" value={editForm.location || ""} onChange={(e) => setEditForm((p) => ({ ...p, location: e.target.value }))} />
                          ) : (
                            <span className="text-muted-foreground truncate max-w-[150px] block">{g.location || "—"}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {isEditing ? (
                            <Select value={editForm.status} onValueChange={(v) => setEditForm((p) => ({ ...p, status: v }))}>
                              <SelectTrigger className="h-7 w-28 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="scheduled">Scheduled</SelectItem>
                                <SelectItem value="completed">Completed</SelectItem>
                                <SelectItem value="cancelled">Cancelled</SelectItem>
                                <SelectItem value="postponed">Postponed</SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (
                            <Badge variant="secondary" className="text-xs capitalize">{g.status}</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {isEditing ? (
                            <div className="flex items-center gap-1">
                              <Input className="h-7 w-12 text-xs" type="number" value={editForm.home_score ?? ""} onChange={(e) => setEditForm((p) => ({ ...p, home_score: e.target.value ? parseInt(e.target.value) : null }))} />
                              <span>-</span>
                              <Input className="h-7 w-12 text-xs" type="number" value={editForm.away_score ?? ""} onChange={(e) => setEditForm((p) => ({ ...p, away_score: e.target.value ? parseInt(e.target.value) : null }))} />
                            </div>
                          ) : (
                            g.home_score !== null && g.away_score !== null ? `${g.home_score}-${g.away_score}` : "—"
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {isEditing ? (
                            <div className="flex items-center gap-1 justify-end">
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={saveEdit}><Save className="h-3 w-3" /></Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingId(null)}><X className="h-3 w-3" /></Button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 justify-end">
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEdit(g)}><Pencil className="h-3 w-3" /></Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => { setDeleteTarget(g.id); setDeleteDialogOpen(true); }}><Trash2 className="h-3 w-3" /></Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Fixture</DialogTitle>
            <DialogDescription>Are you sure? This action cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FixturesManagement;
