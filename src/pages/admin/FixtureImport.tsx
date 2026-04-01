import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
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
  ArrowLeft, Upload, FileSpreadsheet, CheckCircle2, XCircle, Loader2, AlertTriangle, Download,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAdminScope } from "@/hooks/useAdminScope";
import { supabase } from "@/integrations/supabase/client";
import { useTeamContext } from "@/contexts/TeamContext";
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
  const { loading: scopeLoading, isAnyAdmin, isSuperAdmin, scopedAssociationIds } = useAdminScope();
  const { teams, clubs } = useTeamContext();
  const [submitting, setSubmitting] = useState(false);
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<ParsedFixture[]>([]);
  const [importDone, setImportDone] = useState(false);
  const [correctionDialog, setCorrectionDialog] = useState<{ originalName: string; validTeams: string[] } | null>(null);

  const [associations, setAssociations] = useState<{ id: string; name: string }[]>([]);
  const [selectedAssociationId, setSelectedAssociationId] = useState("");

  useEffect(() => {
    if (!scopeLoading && !isAnyAdmin) navigate("/dashboard");
  }, [scopeLoading, isAnyAdmin, navigate]);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from("associations").select("id, name").order("name");
      setAssociations(data || []);
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

  // Build team name -> team_id lookup scoped to association
  const teamNameLookup = useMemo(() => {
    const assocClubs = clubs.filter((c) => c.association_id === selectedAssociationId);
    const assocClubIds = new Set(assocClubs.map((c) => c.id));
    const assocTeams = teams.filter((t) => assocClubIds.has(t.club_id));
    const map = new Map<string, { id: string; club_name: string }>();
    for (const t of assocTeams) {
      const club = assocClubs.find((c) => c.id === t.club_id);
      map.set(t.name.toLowerCase().trim(), { id: t.id, club_name: club?.name || "" });
    }
    return map;
  }, [selectedAssociationId, clubs, teams]);

  const validate = useCallback((parsed: Omit<ParsedFixture, "errors" | "team_id" | "opponent_name" | "is_home">[]): ParsedFixture[] => {
    return parsed.map((r) => {
      const errors: string[] = [];
      if (!r.date) errors.push("Date required");
      if (!r.home_team && !r.away_team) errors.push("Home team and away team required");

      // Try to match one of the teams to our DB
      const homeMatch = teamNameLookup.get(r.home_team.toLowerCase().trim());
      const awayMatch = teamNameLookup.get(r.away_team.toLowerCase().trim());

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

      return { ...r, errors, team_id, opponent_name, is_home };
    });
  }, [teamNameLookup]);

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
  }, [teamNameLookup]);

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

  if (scopeLoading) return null;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/admin/fixtures")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Import Fixtures</h1>
          <p className="text-muted-foreground">Upload a spreadsheet to create fixtures in bulk</p>
        </div>
      </div>

      {/* Association Scope */}
      <Card>
        <CardHeader><CardTitle className="text-lg">Import Scope</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2 max-w-sm">
            <Label>Association</Label>
            <Select value={selectedAssociationId} onValueChange={setSelectedAssociationId} disabled={!isSuperAdmin && scopedAssociationIds.length <= 1}>
              <SelectTrigger><SelectValue placeholder="Select association" /></SelectTrigger>
              <SelectContent>
                {availableAssociations.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Upload */}
      <Card>
        <CardHeader><CardTitle className="text-lg">Upload Spreadsheet</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4 flex-wrap">
            <Label htmlFor="fixture-upload" className="flex items-center gap-2 px-4 py-2 border border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
              <Upload className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">Choose .xlsx or .csv</span>
            </Label>
            <Input id="fixture-upload" type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileUpload} disabled={!selectedAssociationId} />
            <Button variant="outline" size="sm" onClick={() => {
              const headers = ["round_number", "date", "time", "home_team", "away_team", "location", "competition", "notes"];
              const ws = XLSX.utils.aoa_to_sheet([headers]);
              ws["!cols"] = headers.map((h) => ({ wch: Math.max(h.length + 4, 14) }));
              const wb = XLSX.utils.book_new();
              XLSX.utils.book_append_sheet(wb, ws, "Fixtures");
              XLSX.writeFile(wb, "fixture_import_template.xlsx");
            }}>
              <Download className="h-4 w-4 mr-1" />
              Download Template
            </Button>
            {fileName && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <FileSpreadsheet className="h-4 w-4" />{fileName}
              </div>
            )}
          </div>
          <p className="text-xs text-muted-foreground">One of home_team or away_team must match a team in the selected association. Dates in DD/MM/YYYY format.</p>
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
            <div className="rounded-md border overflow-auto max-h-[500px]">
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
                            {r.errors.map((err, i) => (
                              <div key={i} className="flex items-start gap-1">
                                <XCircle className="h-3 w-3 text-destructive shrink-0 mt-0.5" />
                                <span className="text-xs text-destructive">{err}</span>
                              </div>
                            ))}
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
    </div>
  );
};

export default FixtureImport;
