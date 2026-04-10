import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft, Upload, FileSpreadsheet, CheckCircle2, XCircle, Loader2, Download,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAdminScope } from "@/hooks/useAdminScope";
import { supabase } from "@/integrations/supabase/client";
import * as XLSX from "xlsx";

interface ParsedFixture {
  row_number: number;
  round_number: string;
  date: string;
  time: string;
  home_team: string;
  away_team: string;
  location: string;
  competition: string;
  notes: string;
  errors: string[];
  team_id: string | null;
  opponent_name: string;
  is_home: boolean;
}

function parseDate(val: unknown): string {
  if (!val) return "";
  const str = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  if (str.includes("/")) {
    const parts = str.split("/");
    if (parts.length === 3) return `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
  }
  const num = Number(val);
  if (!isNaN(num) && num > 1000 && num < 100000) {
    const d = new Date((num - 25569) * 86400 * 1000);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  return str;
}

function formatDateDisplay(iso: string): string {
  if (!iso) return "";
  const p = iso.split("-");
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : iso;
}

function getField(row: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    if (row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== "") return String(row[k]).trim();
  }
  return "";
}

function parseTime(val: unknown): string {
  if (!val) return "";
  const num = Number(val);
  if (!isNaN(num) && num >= 0 && num < 1) {
    const totalMinutes = Math.round(num * 24 * 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    const period = hours >= 12 ? "PM" : "AM";
    const h12 = hours % 12 || 12;
    return `${h12}:${String(minutes).padStart(2, "0")} ${period}`;
  }
  return String(val).trim();
}

function timeDisplayTo24h(display: string): string {
  if (!display) return "";
  const match = display.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (match) {
    let h = parseInt(match[1]);
    const m = match[2];
    const period = match[3].toUpperCase();
    if (period === "PM" && h !== 12) h += 12;
    if (period === "AM" && h === 12) h = 0;
    return `${String(h).padStart(2, "0")}:${m}`;
  }
  if (/^\d{1,2}:\d{2}$/.test(display)) return display;
  return "";
}

const FixtureImport = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { loading: scopeLoading, isAnyAdmin, isSuperAdmin, scopedAssociationIds, scopedClubIds, scopedTeamIds: adminScopedTeamIds } = useAdminScope();
  const [submitting, setSubmitting] = useState(false);
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<ParsedFixture[]>([]);
  const [importDone, setImportDone] = useState(false);
  const [correctionDialog, setCorrectionDialog] = useState<{ originalName: string; validTeams: string[] } | null>(null);

  // Reference data
  const [associations, setAssociations] = useState<{ id: string; name: string }[]>([]);
  const [clubs, setClubs] = useState<{ id: string; name: string; association_id: string }[]>([]);
  const [teams, setTeams] = useState<{ id: string; name: string; club_id: string; division: string | null }[]>([]);

  // Cascade state
  const [selectedAssociationId, setSelectedAssociationId] = useState("");
  const [selectedClubId, setSelectedClubId] = useState("");
  const [selectedDivision, setSelectedDivision] = useState("");
  const [selectedTeamId, setSelectedTeamId] = useState("");

  useEffect(() => {
    if (!scopeLoading && !isAnyAdmin) navigate("/dashboard");
  }, [scopeLoading, isAnyAdmin, navigate]);

  useEffect(() => {
    const load = async () => {
      const [aRes, cRes, tRes] = await Promise.all([
        supabase.from("associations").select("id, name").order("name"),
        supabase.from("clubs").select("id, name, association_id").order("name"),
        supabase.from("teams").select("id, name, club_id, division").order("name"),
      ]);
      setAssociations(aRes.data || []);
      setClubs(cRes.data || []);
      setTeams(tRes.data || []);
    };
    load();
  }, []);

  useEffect(() => {
    if (!scopeLoading && !isSuperAdmin && scopedAssociationIds.length === 1) {
      setSelectedAssociationId(scopedAssociationIds[0]);
    }
  }, [scopeLoading, isSuperAdmin, scopedAssociationIds]);

  const availableAssociations = isSuperAdmin
    ? associations
    : associations.filter((a) => scopedAssociationIds.includes(a.id));

  // Cascade filtering
  const assocClubs = useMemo(() => {
    const filtered = clubs.filter((c) => c.association_id === selectedAssociationId);
    if (isSuperAdmin) return filtered;
    if (scopedClubIds.length > 0) return filtered.filter((c) => scopedClubIds.includes(c.id));
    if (scopedAssociationIds.includes(selectedAssociationId)) return filtered;
    return filtered.filter((c) => teams.some((t) => t.club_id === c.id && adminScopedTeamIds.includes(t.id)));
  }, [selectedAssociationId, clubs, isSuperAdmin, scopedClubIds, scopedAssociationIds, adminScopedTeamIds, teams]);

  const assocTeams = useMemo(() => {
    const clubIds = new Set(assocClubs.map((c) => c.id));
    let filtered = teams.filter((t) => clubIds.has(t.club_id));
    if (!isSuperAdmin && adminScopedTeamIds.length > 0 && !scopedAssociationIds.includes(selectedAssociationId) && scopedClubIds.length === 0) {
      filtered = filtered.filter((t) => adminScopedTeamIds.includes(t.id));
    }
    return filtered;
  }, [assocClubs, teams, isSuperAdmin, adminScopedTeamIds, scopedAssociationIds, selectedAssociationId, scopedClubIds]);

  const cascadeClubs = assocClubs;

  const cascadeDivisions = useMemo(() => {
    let filtered = assocTeams;
    if (selectedClubId) filtered = filtered.filter((t) => t.club_id === selectedClubId);
    const divs = new Set<string>();
    filtered.forEach((t) => { if (t.division) divs.add(t.division); });
    return Array.from(divs).sort();
  }, [assocTeams, selectedClubId]);

  const cascadeTeams = useMemo(() => {
    let filtered = assocTeams;
    if (selectedClubId) filtered = filtered.filter((t) => t.club_id === selectedClubId);
    if (selectedDivision) filtered = filtered.filter((t) => t.division === selectedDivision);
    return filtered;
  }, [assocTeams, selectedClubId, selectedDivision]);

  const handleAssociationChange = (id: string) => {
    setSelectedAssociationId(id);
    setSelectedClubId("");
    setSelectedDivision("");
    setSelectedTeamId("");
  };

  const handleClubChange = (id: string) => {
    setSelectedClubId(id);
    setSelectedDivision("");
    setSelectedTeamId("");
  };

  const handleDivisionChange = (d: string) => {
    setSelectedDivision(d);
    setSelectedTeamId("");
  };

  // Team name lookup scoped to cascade
  const teamNameLookup = useMemo(() => {
    const map = new Map<string, { id: string; club_name: string }>();
    for (const t of cascadeTeams) {
      const club = assocClubs.find((c) => c.id === t.club_id);
      map.set(t.name.toLowerCase().trim(), { id: t.id, club_name: club?.name || "" });
    }
    return map;
  }, [cascadeTeams, assocClubs]);

  // Full association-level team lookup for matching (scope enforcement happens separately)
  const allAssocTeamLookup = useMemo(() => {
    const map = new Map<string, { id: string; club_name: string }>();
    for (const t of assocTeams) {
      const club = assocClubs.find((c) => c.id === t.club_id);
      map.set(t.name.toLowerCase().trim(), { id: t.id, club_name: club?.name || "" });
    }
    return map;
  }, [assocTeams, assocClubs]);

  const scopeTeamIds = useMemo(() => new Set(cascadeTeams.map((t) => t.id)), [cascadeTeams]);

  const validate = useCallback((parsed: Omit<ParsedFixture, "errors" | "team_id" | "opponent_name" | "is_home">[]): ParsedFixture[] => {
    return parsed.map((r) => {
      const errors: string[] = [];
      if (!r.date) errors.push("Date required");
      if (!r.home_team && !r.away_team) errors.push("Home team and away team required");

      const homeMatch = allAssocTeamLookup.get(r.home_team.toLowerCase().trim());
      const awayMatch = allAssocTeamLookup.get(r.away_team.toLowerCase().trim());

      let team_id: string | null = null;
      let opponent_name = "";
      let is_home = true;

      if (homeMatch) {
        team_id = homeMatch.id;
        opponent_name = r.away_team || "TBA";
        is_home = true;
      } else if (awayMatch) {
        team_id = awayMatch.id;
        opponent_name = r.home_team || "TBA";
        is_home = false;
      } else {
        errors.push(`Neither '${r.home_team}' nor '${r.away_team}' found as a team in this association`);
      }

      // Scope enforcement
      if (team_id && errors.length === 0 && !scopeTeamIds.has(team_id)) {
        const team = teams.find((t) => t.id === team_id);
        const club = team ? clubs.find((c) => c.id === team.club_id) : null;
        const scopeDesc = selectedTeamId
          ? `team '${cascadeTeams.find((t) => t.id === selectedTeamId)?.name || ""}'`
          : selectedDivision
          ? `division '${selectedDivision}'`
          : selectedClubId
          ? `club '${cascadeClubs.find((c) => c.id === selectedClubId)?.name || ""}'`
          : "selected scope";
        errors.push(`Row outside selected scope (${scopeDesc}). Resolved to ${club?.name || "unknown"} / ${team?.division || "unknown"}.`);
        team_id = null;
      }

      return { ...r, errors, team_id, opponent_name, is_home };
    });
  }, [allAssocTeamLookup, scopeTeamIds, selectedTeamId, selectedDivision, selectedClubId, cascadeTeams, cascadeClubs, teams, clubs]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setImportDone(false);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

        const parsed = json.map((row, i) => ({
          row_number: i + 2,
          round_number: getField(row, "round_number", "Round", "Rd"),
          date: parseDate(row["date"] || row["Date"] || row["game_date"] || ""),
          time: parseTime(row["time"] || row["Time"] || ""),
          home_team: getField(row, "home_team", "Home Team", "Home"),
          away_team: getField(row, "away_team", "Away Team", "Away"),
          location: getField(row, "location", "Location", "Venue"),
          competition: getField(row, "competition", "Competition", "Comp"),
          notes: getField(row, "notes", "Notes"),
        }));

        setRows(validate(parsed));
      } catch {
        toast({ title: "Parse Error", description: "Could not read the spreadsheet.", variant: "destructive" });
      }
    };
    reader.readAsArrayBuffer(file);
  };

  useEffect(() => {
    if (rows.length > 0) {
      setRows((prev) => validate(prev.map(({ errors, team_id, opponent_name, is_home, ...rest }) => rest)));
    }
  }, [allAssocTeamLookup, scopeTeamIds]);

  const validRows = rows.filter((r) => r.errors.length === 0);
  const errorRows = rows.filter((r) => r.errors.length > 0);

  const handleSubmit = async () => {
    if (validRows.length === 0) return;
    setSubmitting(true);

    const inserts = validRows.map((r) => {
      const time24 = timeDisplayTo24h(r.time);
      let gameDate = r.date;
      if (time24) gameDate += `T${time24}:00`;
      else gameDate += "T00:00:00";

      return {
        team_id: r.team_id!,
        opponent_name: r.opponent_name,
        game_date: gameDate,
        is_home: r.is_home,
        location: r.location || null,
        round_number: r.round_number ? parseInt(r.round_number) : null,
        notes: r.notes || null,
        status: "scheduled",
      };
    });

    const { error } = await supabase.from("games").insert(inserts);
    setSubmitting(false);

    if (error) {
      toast({ title: "Import Failed", description: error.message, variant: "destructive" });
      return;
    }

    setImportDone(true);
    toast({ title: "Fixtures Imported", description: `${validRows.length} fixture(s) created.` });
  };

  const downloadTemplate = () => {
    const headers = ["round_number", "date", "time", "home_team", "away_team", "location", "competition", "notes"];

    // Pre-fill row 2 with cascade values
    const selectedTeamName = cascadeTeams.find((t) => t.id === selectedTeamId)?.name || "";
    const prefillRow = headers.map((h) => {
      if (h === "home_team") return selectedTeamName;
      if (h === "competition") return selectedDivision;
      return "";
    });

    const ws = XLSX.utils.aoa_to_sheet([headers, prefillRow]);
    ws["!cols"] = headers.map((h) => ({ wch: Math.max(h.length + 4, 14) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Fixtures");

    // Allowed Values reference sheet
    const scopedTeamNames = cascadeTeams.map((t) => t.name);
    const refHeaders = ["Status", "Home Team / Away Team"];
    const statusValues = ["scheduled"];
    const maxLen = Math.max(statusValues.length, scopedTeamNames.length);
    const refData: string[][] = [refHeaders];
    for (let i = 0; i < maxLen; i++) {
      refData.push([statusValues[i] || "", scopedTeamNames[i] || ""]);
    }
    const refWs = XLSX.utils.aoa_to_sheet(refData);
    refWs["!cols"] = refHeaders.map((h) => ({ wch: Math.max(h.length + 4, 24) }));
    XLSX.utils.book_append_sheet(wb, refWs, "Allowed Values");

    XLSX.writeFile(wb, "fixture_import_template.xlsx");
  };

  if (scopeLoading) return null;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/admin/fixtures")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Import Fixtures</h1>
          <p className="text-muted-foreground">Upload a spreadsheet to create fixtures in bulk</p>
        </div>
      </div>

      {/* Import Scope — Cascade Selector */}
      <Card>
        <CardHeader><CardTitle className="text-lg">Import Scope</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label>Association</Label>
              <Select value={selectedAssociationId} onValueChange={handleAssociationChange} disabled={!isSuperAdmin && scopedAssociationIds.length <= 1}>
                <SelectTrigger><SelectValue placeholder="Select association" /></SelectTrigger>
                <SelectContent>
                  {availableAssociations.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Club</Label>
              <Select value={selectedClubId} onValueChange={handleClubChange} disabled={!selectedAssociationId || cascadeClubs.length === 0}>
                <SelectTrigger><SelectValue placeholder="All clubs" /></SelectTrigger>
                <SelectContent>
                  {cascadeClubs.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Division</Label>
              <Select value={selectedDivision} onValueChange={handleDivisionChange} disabled={cascadeDivisions.length === 0}>
                <SelectTrigger><SelectValue placeholder="All divisions" /></SelectTrigger>
                <SelectContent>
                  {cascadeDivisions.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Team</Label>
              <Select value={selectedTeamId} onValueChange={setSelectedTeamId} disabled={cascadeTeams.length === 0}>
                <SelectTrigger><SelectValue placeholder="All teams" /></SelectTrigger>
                <SelectContent>
                  {cascadeTeams.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Rows outside the selected scope will be rejected. Association is the minimum required selection.
          </p>
        </CardContent>
      </Card>

      {/* Upload */}
      <Card>
        <CardHeader><CardTitle className="text-lg">Upload Spreadsheet</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4 flex-wrap">
            <Label htmlFor="fixture-upload" className="flex items-center gap-2 px-4 py-2 border border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
              <Upload className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">Choose .xlsx or .csv file</span>
            </Label>
            <Input id="fixture-upload" type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileUpload} disabled={!selectedAssociationId} />
            <Button variant="outline" size="sm" onClick={downloadTemplate}>
              <Download className="h-4 w-4 mr-1" />
              Download Template
            </Button>
            {fileName && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <FileSpreadsheet className="h-4 w-4" />{fileName}
              </div>
            )}
          </div>
          <div className="text-xs text-muted-foreground space-y-1">
            <p>Supported formats: <span className="font-medium">.xlsx, .xls, .csv</span></p>
            <p>Dates in DD/MM/YYYY format. One of home_team or away_team must match a team in the selected scope.</p>
            <p>The template includes an "Allowed Values" reference sheet with valid team names and statuses.</p>
          </div>
        </CardContent>
      </Card>

      {/* Preview */}
      {rows.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Preview ({rows.length} rows)</CardTitle>
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="text-green-600 border-green-300">
                <CheckCircle2 className="h-3 w-3 mr-1" />{validRows.length} valid
              </Badge>
              {errorRows.length > 0 && (
                <Badge variant="outline" className="text-destructive border-destructive/30">
                  <XCircle className="h-3 w-3 mr-1" />{errorRows.length} errors
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border overflow-auto max-h-[600px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Round</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Home Team</TableHead>
                    <TableHead>Away Team</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead className="w-32">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.row_number} className={r.errors.length > 0 ? "bg-destructive/5" : ""}>
                      <TableCell className="font-mono text-xs">{r.row_number}</TableCell>
                      <TableCell className="text-xs">{r.round_number}</TableCell>
                      <TableCell className="text-xs whitespace-nowrap">{formatDateDisplay(r.date)}</TableCell>
                      <TableCell className="text-xs">{r.time}</TableCell>
                      <TableCell className="text-xs">{r.home_team}</TableCell>
                      <TableCell className="text-xs">{r.away_team}</TableCell>
                      <TableCell className="text-xs">{r.location}</TableCell>
                      <TableCell className="text-xs max-w-[100px] truncate">{r.notes}</TableCell>
                      <TableCell>
                        {r.errors.length === 0 ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                        ) : (
                          <div className="space-y-0.5">
                            {r.errors.map((err, i) => {
                              const teamNotFoundMatch = err.match(/Neither '(.+?)' nor '(.+?)' found/);
                              if (teamNotFoundMatch) {
                                return (
                                  <div key={i} className="flex items-start gap-1 flex-wrap">
                                    <XCircle className="h-3 w-3 text-destructive shrink-0 mt-0.5" />
                                    <span className="text-xs text-destructive">
                                      Team not found:{" "}
                                      <button className="underline text-primary font-medium" onClick={() => setCorrectionDialog({ originalName: teamNotFoundMatch[1], validTeams: Array.from(teamNameLookup.keys()) })}>
                                        {teamNotFoundMatch[1]}
                                      </button>
                                      {" / "}
                                      <button className="underline text-primary font-medium" onClick={() => setCorrectionDialog({ originalName: teamNotFoundMatch[2], validTeams: Array.from(teamNameLookup.keys()) })}>
                                        {teamNotFoundMatch[2]}
                                      </button>
                                    </span>
                                  </div>
                                );
                              }
                              return (
                                <div key={i} className="flex items-start gap-1">
                                  <XCircle className="h-3 w-3 text-destructive shrink-0 mt-0.5" />
                                  <span className="text-xs text-destructive">{err}</span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {importDone && (
        <Card>
          <CardContent className="py-6 text-center">
            <CheckCircle2 className="h-8 w-8 text-green-600 mx-auto mb-2" />
            <p className="font-medium">{validRows.length} fixture(s) imported successfully!</p>
            <Button variant="link" onClick={() => navigate("/admin/fixtures")}>View Fixtures</Button>
          </CardContent>
        </Card>
      )}

      {rows.length > 0 && !importDone && (
        <Button className="w-full" size="lg" disabled={submitting || validRows.length === 0} onClick={handleSubmit}>
          {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
          {submitting ? "Importing..." : `Import ${validRows.length} Fixture(s)`}
        </Button>
      )}

      {/* Correction Dialog */}
      {correctionDialog && (
        <AlertDialog open={!!correctionDialog} onOpenChange={(open) => !open && setCorrectionDialog(null)}>
          <AlertDialogContent className="max-h-[80vh] overflow-y-auto">
            <AlertDialogHeader>
              <AlertDialogTitle>Replace '{correctionDialog.originalName}'</AlertDialogTitle>
              <AlertDialogDescription>Select the correct team name. "Change All" will replace every instance in the import.</AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-1 max-h-60 overflow-y-auto border rounded-md p-2">
              {correctionDialog.validTeams.map((name) => (
                <button
                  key={name}
                  className="w-full text-left px-3 py-2 rounded hover:bg-muted text-sm capitalize"
                  onClick={() => {
                    const original = correctionDialog.originalName.toLowerCase().trim();
                    const replacement = name;
                    setRows((prev) => {
                      const updated = prev.map((r) => ({
                        ...r,
                        home_team: r.home_team.toLowerCase().trim() === original ? replacement.charAt(0).toUpperCase() + replacement.slice(1) : r.home_team,
                        away_team: r.away_team.toLowerCase().trim() === original ? replacement.charAt(0).toUpperCase() + replacement.slice(1) : r.away_team,
                      }));
                      return validate(updated.map(({ errors, team_id, opponent_name, is_home, ...rest }) => rest));
                    });
                    setCorrectionDialog(null);
                    toast({ title: "Replaced", description: `All instances of '${correctionDialog.originalName}' updated.` });
                  }}
                >
                  {name}
                </button>
              ))}
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
};

export default FixtureImport;
