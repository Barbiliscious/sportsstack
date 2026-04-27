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
  const [allAssocTeams, setAllAssocTeams] = useState<{ id: string; name: string; club_id: string }[]>([]);
  const uniqueAssocTeamNames = [...new Set(allAssocTeams.map(t => t.name.trim()))].sort();
  const [venues, setVenues] = useState<{ id: string; name: string }[]>([]);
  const [pitches, setPitches] = useState<{ id: string; name: string; venue_id: string }[]>([]);
  const [clubs, setClubs] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    const loadRefData = async () => {
      if (!selectedAssociationId) return;
      const [cRes, vRes] = await Promise.all([
        supabase.from("clubs").select("id, name").eq("association_id", selectedAssociationId),
        supabase.from("venues").select("id, name").eq("association_id", selectedAssociationId),
      ]);
      const loadedClubs = cRes.data || [];
      const loadedVenues = vRes.data || [];
      setClubs(loadedClubs);
      setVenues(loadedVenues);

      if (loadedClubs.length > 0) {
        const { data: tRes } = await supabase.from("teams").select("id, name, club_id").in("club_id", loadedClubs.map(c => c.id));
        setAllAssocTeams(tRes || []);
      } else {
        setAllAssocTeams([]);
      }

      if (loadedVenues.length > 0) {
        const { data: pRes } = await supabase.from("pitches").select("id, name, venue_id").in("venue_id", loadedVenues.map(v => v.id));
        setPitches(pRes || []);
      } else {
        setPitches([]);
      }
    };
    loadRefData();
  }, [selectedAssociationId]);

  const [addForm, setAddForm] = useState({
    team_id: "", opponent_name: "", game_date: "", game_time: "",
    venue_id: "", pitch_id: "", round_number: "", status: "scheduled",
    umpire_club_1: "", umpire_club_2: "", is_bye: false
  });
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterRound, setFilterRound] = useState("");

  const teamIds = selectedTeamId
    ? [selectedTeamId]
    : scopedTeamIds.length > 0
    ? scopedTeamIds
    : [];

  const [assocTeamIds, setAssocTeamIds] = useState<string[]>([]);
  
  useEffect(() => {
    if (selectedAssociationId && teamIds.length === 0) {
      const fetchAssocTeams = async () => {
        const { data: clubs } = await supabase.from("clubs").select("id").eq("association_id", selectedAssociationId);
        if (clubs && clubs.length > 0) {
          const clubIds = clubs.map(c => c.id);
          const { data: teams } = await supabase.from("teams").select("id").in("club_id", clubIds);
          if (teams) setAssocTeamIds(teams.map(t => t.id));
        } else {
          setAssocTeamIds([]);
        }
      };
      fetchAssocTeams();
    } else {
      setAssocTeamIds([]);
    }
  }, [selectedAssociationId, teamIds.join(",")]);

  const fetchGames = async () => {
    const idsToUse = teamIds.length > 0 ? teamIds : assocTeamIds;
    if (idsToUse.length === 0) {
      setGames([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("games")
      .select("*")
      .in("team_id", idsToUse)
      .order("game_date", { ascending: true });
    setGames((data as GameWithTeam[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchGames();
  }, [teamIds.join(","), assocTeamIds.join(",")]);

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
    if (!addForm.team_id || (!addForm.is_bye && !addForm.opponent_name) || !addForm.game_date) {
      toast({ title: "Error", description: "Team, opponent and date are required.", variant: "destructive" });
      return;
    }

    if (addForm.round_number) {
      const { data: existing } = await supabase.from("games")
        .select("id").eq("team_id", addForm.team_id)
        .eq("round_number", parseInt(addForm.round_number)).limit(1);
      if (existing && existing.length > 0) {
        const confirmed = window.confirm(`A fixture for this team in Round ${addForm.round_number} already exists. Are you sure you want to add another?`);
        if (!confirmed) return;
      }
    }

    const gameDate = addForm.game_time ? `${addForm.game_date}T${addForm.game_time}:00` : `${addForm.game_date}T00:00:00`;
    const { error } = await supabase.from("games").insert({
      team_id: addForm.team_id,
      opponent_name: addForm.is_bye ? "BYE" : addForm.opponent_name,
      game_date: gameDate,
      is_home: true,
      location: addForm.venue_id
        ? `${venues.find(v => v.id === addForm.venue_id)?.name ?? ""}${addForm.pitch_id ? ` – ${pitches.find(p => p.id === addForm.pitch_id)?.name ?? ""}` : ""}`
        : null,
      round_number: addForm.round_number ? parseInt(addForm.round_number) : null,
      status: addForm.status,
      umpire_club_1: addForm.umpire_club_1 || null,
      umpire_club_2: addForm.umpire_club_2 || null,
      is_bye: addForm.is_bye,
    });
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Created", description: "Fixture added." });
    setAddDialogOpen(false);
    setAddForm({ 
      team_id: "", opponent_name: "", game_date: "", game_time: "", 
      venue_id: "", pitch_id: "", round_number: "", status: "scheduled",
      umpire_club_1: "", umpire_club_2: "", is_bye: false
    });
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
              {displayGames.length} Fixture{displayGames.length !== 1 ? "s" : ""}
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
                  {displayGames.map((g) => {
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

      {/* Add Fixture Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Fixture</DialogTitle>
            <DialogDescription>Manually create a single fixture.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Team *</Label>
              <Select value={addForm.team_id || "__none__"} onValueChange={(v) => { if (v === "__none__") setAddForm((p) => ({ ...p, team_id: "" })); else setAddForm((p) => ({ ...p, team_id: v })); }}>
                <SelectTrigger><SelectValue placeholder="Select team" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— None —</SelectItem>
                  {allAssocTeams
                    .filter((t, idx, arr) => arr.findIndex(x => x.name.trim() === t.name.trim()) === idx)
                    .map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Opponent *</Label>
              <Select value={addForm.is_bye ? "BYE" : (addForm.opponent_name || "__none__")} onValueChange={(v) => { if (v === "__none__") setAddForm(p => ({ ...p, opponent_name: "", is_bye: false })); else if (v === "BYE") setAddForm(p => ({ ...p, opponent_name: "", is_bye: true })); else setAddForm(p => ({ ...p, opponent_name: v, is_bye: false })); }}>
                <SelectTrigger><SelectValue placeholder="Select opponent" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— None —</SelectItem>
                  <SelectItem value="BYE">BYE</SelectItem>
                  {uniqueAssocTeamNames.map((name) => (
                    <SelectItem key={name} value={name}>{name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Date *</Label>
                <Input type="date" value={addForm.game_date} onChange={(e) => setAddForm((p) => ({ ...p, game_date: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Time</Label>
                <Input type="time" value={addForm.game_time} onChange={(e) => setAddForm((p) => ({ ...p, game_time: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Venue</Label>
                <Select value={addForm.venue_id || "__none__"} onValueChange={(v) => { if (v === "__none__") setAddForm(p => ({ ...p, venue_id: "", pitch_id: "" })); else setAddForm(p => ({ ...p, venue_id: v, pitch_id: "" })); }}>
                  <SelectTrigger><SelectValue placeholder="Select venue" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— None —</SelectItem>
                    {venues.map((v) => (
                      <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Pitch</Label>
                <Select disabled={!addForm.venue_id} value={addForm.pitch_id || "__none__"} onValueChange={(v) => { if (v === "__none__") setAddForm(p => ({ ...p, pitch_id: "" })); else setAddForm(p => ({ ...p, pitch_id: v })); }}>
                  <SelectTrigger><SelectValue placeholder="Select pitch" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— None —</SelectItem>
                    {pitches.filter(p => p.venue_id === addForm.venue_id).map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Round</Label>
              <Input type="number" value={addForm.round_number} onChange={(e) => setAddForm((p) => ({ ...p, round_number: e.target.value }))} placeholder="#" />
            </div>
            {!addForm.is_bye && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Umpire 1 (Club)</Label>
                  <Select value={addForm.umpire_club_1 || "__none__"} onValueChange={(v) => { if (v === "__none__") setAddForm(p => ({ ...p, umpire_club_1: "" })); else setAddForm(p => ({ ...p, umpire_club_1: v })); }}>
                    <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— None —</SelectItem>
                      {clubs.map((c) => (
                        <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Umpire 2 (Club)</Label>
                  <Select value={addForm.umpire_club_2 || "__none__"} onValueChange={(v) => { if (v === "__none__") setAddForm(p => ({ ...p, umpire_club_2: "" })); else setAddForm(p => ({ ...p, umpire_club_2: v })); }}>
                    <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— None —</SelectItem>
                      {clubs.map((c) => (
                        <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAddFixture}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FixturesManagement;
