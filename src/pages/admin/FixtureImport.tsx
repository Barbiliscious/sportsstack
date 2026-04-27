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
  ArrowLeft, Upload, FileSpreadsheet, CheckCircle2, XCircle, Loader2, Download, X,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAdminScope } from "@/hooks/useAdminScope";
import { supabase } from "@/integrations/supabase/client";
import * as XLSX from "xlsx";

interface ParsedFixture {
  row_number: number;
  round_number: number | null;
  round_name: string;
  date: string;
  time: string;
  venue: string;
  pitch: string;
  grade: string;
  home_team: string;
  away_team: string;
  umpire_1: string;
  umpire_2: string;
  is_bye: boolean;
  
  // Resolved
  errors: string[];
  team_id: string | null;
  opponent_name: string;
  resolved_venue: string;
  resolved_grade: string;
  bye_team_id: string | null;
}

function parseDate(val: unknown): string {
  if (!val) return "";
  const str = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  if (str.includes("/")) {
    const parts = str.split("/");
    if (parts.length === 3) {
      const year = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
      return `${year}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
    }
  }
  const num = Number(val);
  if (!isNaN(num) && num > 1000 && num < 100000) {
    const d = new Date((num - 25569) * 86400 * 1000);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  const d = new Date(str);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return str;
}

function parseTime(val: unknown): string {
  if (!val) return "";
  const num = Number(val);
  if (!isNaN(num) && num >= 0 && num < 1) {
    const totalMinutes = Math.round(num * 24 * 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  }
  const str = String(val).trim();
  const match = str.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (match) {
    let h = parseInt(match[1]);
    const m = match[2];
    const period = match[3]?.toUpperCase();
    if (period === "PM" && h !== 12) h += 12;
    if (period === "AM" && h === 12) h = 0;
    return `${String(h).padStart(2, "0")}:${m}`;
  }
  if (/^\d{1,2}:\d{2}$/.test(str)) return str;
  return str;
}

function getField(row: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    if (row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== "") return String(row[k]).trim();
  }
  return "";
}

const FixtureImport = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { loading: scopeLoading, isAnyAdmin, isSuperAdmin, scopedAssociationIds, scopedClubIds, scopedTeamIds: adminScopedTeamIds } = useAdminScope();
  
  const [submitting, setSubmitting] = useState(false);
  const [fileName, setFileName] = useState("");
  const [fileKey, setFileKey] = useState(0);
  const [rows, setRows] = useState<ParsedFixture[]>([]);
  const [importDone, setImportDone] = useState(false);

  // Reference data
  const [associations, setAssociations] = useState<{ id: string; name: string }[]>([]);
  const [clubs, setClubs] = useState<{ id: string; name: string; association_id: string }[]>([]);
  const [teams, setTeams] = useState<{ id: string; name: string; club_id: string; division: string | null }[]>([]);
  const [venues, setVenues] = useState<{ id: string; name: string; association_id: string | null }[]>([]);
  const [pitches, setPitches] = useState<{ id: string; name: string; venue_id: string }[]>([]);

  // Cascade state
  const [selectedAssociationId, setSelectedAssociationId] = useState("");
  const [selectedClubId, setSelectedClubId] = useState("");
  const [selectedDivision, setSelectedDivision] = useState("");

  useEffect(() => {
    if (!scopeLoading && !isAnyAdmin) navigate("/admin");
  }, [scopeLoading, isAnyAdmin, navigate]);

  useEffect(() => {
    const load = async () => {
      const [aRes, cRes, tRes, vRes, pRes] = await Promise.all([
        supabase.from("associations").select("id, name").order("name"),
        supabase.from("clubs").select("id, name, association_id").order("name"),
        supabase.from("teams").select("id, name, club_id, division").order("name"),
        supabase.from("venues").select("id, name, association_id").order("name"),
        supabase.from("pitches").select("id, name, venue_id").order("name"),
      ]);
      setAssociations(aRes.data || []);
      setClubs(cRes.data || []);
      setTeams(tRes.data || []);
      setVenues(vRes.data || []);
      setPitches(pRes.data || []);
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

  // Cascade filtering for Clubs
  const assocClubs = useMemo(() => {
    const filtered = clubs.filter((c) => c.association_id === selectedAssociationId);
    if (isSuperAdmin) return filtered;
    if (scopedClubIds.length > 0) return filtered.filter((c) => scopedClubIds.includes(c.id));
    if (scopedAssociationIds.includes(selectedAssociationId)) return filtered;
    return filtered.filter((c) => teams.some((t) => t.club_id === c.id && adminScopedTeamIds.includes(t.id)));
  }, [selectedAssociationId, clubs, isSuperAdmin, scopedClubIds, scopedAssociationIds, adminScopedTeamIds, teams]);

  const cascadeClubs = assocClubs;

  // Teams in the association (for validation mapping)
  const assocTeams = useMemo(() => {
    const allAssocClubs = clubs.filter((c) => c.association_id === selectedAssociationId);
    const clubIds = new Set(allAssocClubs.map((c) => c.id));
    return teams.filter((t) => clubIds.has(t.club_id));
  }, [clubs, teams, selectedAssociationId]);

  const cascadeDivisions = useMemo(() => {
    let filtered = assocTeams;
    if (selectedClubId) filtered = filtered.filter((t) => t.club_id === selectedClubId);
    const divs = new Set<string>();
    filtered.forEach((t) => { if (t.division) divs.add(t.division); });
    return Array.from(divs).sort();
  }, [assocTeams, selectedClubId]);

  // Full association-level team lookup for matching
  const allAssocTeamLookup = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();
    for (const t of assocTeams) {
      map.set(t.name.toLowerCase().trim(), { id: t.id, name: t.name });
    }
    return map;
  }, [assocTeams]);

  // Allowed divisions
  const allAssocDivisions = useMemo(() => {
    const s = new Set<string>();
    assocTeams.forEach(t => { if (t.division) s.add(t.division); });
    return Array.from(s);
  }, [assocTeams]);

  // Allowed venues
  const allVenuesLower = useMemo(() => {
    const map = new Map<string, string>();
    for (const v of venues) {
      map.set(v.name.toLowerCase().trim(), v.name);
    }
    return map;
  }, [venues]);

  const validate = useCallback((parsed: Omit<ParsedFixture, "errors" | "team_id" | "opponent_name" | "resolved_venue" | "resolved_grade" | "bye_team_id">[]): ParsedFixture[] => {
    return parsed.map((r) => {
      const errors: string[] = [];

      // Validations
      // Bye inference
      const is_bye = r.home_team && !r.away_team;
      r.is_bye = !!is_bye;

      // Validations
      if (!r.date) errors.push("Date required");
      if (!is_bye && !r.time) errors.push("Time required");
      if (!r.home_team) errors.push("Home team required");

      let team_id: string | null = null;
      let opponent_name = "";
      let bye_team_id: string | null = null;
      let resolved_venue = r.venue;
      let resolved_grade = r.grade;

      // Handle Home Team
      if (r.home_team) {
        const homeMatch = allAssocTeamLookup.get(r.home_team.toLowerCase().trim());
        if (homeMatch) {
          team_id = homeMatch.id;
          if (is_bye) {
            bye_team_id = homeMatch.id;
            opponent_name = "BYE";
          }
        } else {
          errors.push(`Home team '${r.home_team}' not found`);
        }
      }

      // Handle Away Team Validation
      if (!is_bye) {
        if (!r.venue) errors.push("Venue required");
        if (r.away_team) {
          const awayMatch = allAssocTeamLookup.get(r.away_team.toLowerCase().trim());
          if (!awayMatch) {
            errors.push(`Away team '${r.away_team}' not found`);
          } else {
            opponent_name = awayMatch.name;
          }
        } else {
          errors.push("Away team required");
        }
      }

      // Venue match
      if (r.venue) {
        const vMatch = allVenuesLower.get(r.venue.toLowerCase().trim());
        if (vMatch) resolved_venue = vMatch;
        else errors.push(`Venue '${r.venue}' not found in venues table`);
      }

      // Pitch/venue conflict check
      if (r.pitch && r.venue) {
        const matchedVenue = venues.find(v => v.name.toLowerCase().trim() === r.venue.toLowerCase().trim());
        if (matchedVenue) {
          const pitchBelongsToVenue = pitches.some(
            p => p.venue_id === matchedVenue.id && p.name.toLowerCase().trim() === r.pitch.toLowerCase().trim()
          );
          if (!pitchBelongsToVenue) {
            errors.push(`Pitch '${r.pitch}' does not belong to venue '${r.venue}'`);
          }
        }
      }

      // Grade match
      if (r.grade) {
        const dMatch = allAssocDivisions.find(d => d.toLowerCase().trim() === r.grade.toLowerCase().trim());
        if (dMatch) resolved_grade = dMatch;
        else errors.push(`Grade '${r.grade}' not found in teams divisions`);
      }

      return { 
        ...r, 
        errors, 
        team_id, 
        opponent_name, 
        resolved_venue, 
        resolved_grade, 
        bye_team_id 
      };
    });
  }, [allAssocTeamLookup, allVenuesLower, allAssocDivisions, venues, pitches]);

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
        // Support the 3-row layout where row 1 might be notes
        let headerRow = 0;
        const A1 = sheet["A1"]?.v != null ? String(sheet["A1"].v).trim() : "";
        const A2 = sheet["A2"]?.v != null ? String(sheet["A2"].v).trim() : "";
        if (A1 === "" && A2.startsWith("round_number")) {
          headerRow = 1;
        }

        const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "", range: headerRow });

        const parsed = json.map((row, i) => {
          const roundRaw = getField(row, "round_number *", "round_number", "Round", "Rd");
          return {
            row_number: headerRow + i + 2,
            round_number: roundRaw ? parseInt(roundRaw) : null,
            round_name: getField(row, "round_name (optional)", "round_name", "Round Name", "Event"),
            date: parseDate(row["date *"] || row["date"] || row["Date"] || ""),
            time: parseTime(row["time *"] || row["time"] || row["Time"] || ""),
            venue: getField(row, "venue *", "venue", "Venue", "Location"),
            pitch: getField(row, "pitch *", "pitch", "Pitch", "Field"),
            grade: getField(row, "grade *", "grade", "Grade", "Division"),
            home_team: getField(row, "home_team *", "home_team", "Home Team", "Home"),
            away_team: getField(row, "away_team (Leave blank for bye)", "away_team", "Away Team", "Away"),
            umpire_1: getField(row, "umpire_1", "Umpire 1", "Umpire1"),
            umpire_2: getField(row, "umpire_2", "Umpire 2", "Umpire2"),
            is_bye: false, // Calculated in validate
          };
        });

        setRows(validate(parsed));
      } catch (err) {
        console.error(err);
        toast({ title: "Parse Error", description: "Could not read the spreadsheet.", variant: "destructive" });
      }
    };
    reader.readAsArrayBuffer(file);
  };

  useEffect(() => {
    if (rows.length > 0) {
      setRows((prev) => validate(prev.map(({ errors, team_id, opponent_name, resolved_venue, resolved_grade, bye_team_id, ...rest }) => rest)));
    }
  }, [selectedAssociationId, allAssocTeamLookup, validate]);

  const validRows = rows.filter((r) => r.errors.length === 0);
  const errorRows = rows.filter((r) => r.errors.length > 0);

  const handleSubmit = async () => {
    if (validRows.length === 0) return;
    setSubmitting(true);

    const inserts = validRows.map((r) => {
      let gameDate = r.date;
      if (r.time) gameDate += `T${r.time}:00`;
      else if (gameDate) gameDate += "T00:00:00";
      
      return {
        team_id: r.team_id,
        opponent_name: r.opponent_name || null,
        game_date: gameDate || null,
        location: r.resolved_venue || null,
        pitch: r.pitch || null,
        is_home: true,
        status: "scheduled",
        round_number: r.round_number,
        round_name: r.round_name || null,
        grade: r.resolved_grade || null,
        umpire_club_1: r.umpire_1 || null,
        umpire_club_2: r.umpire_2 || null,
        is_bye: r.is_bye,
        bye_team_id: r.bye_team_id,
      };
    });

    const { error } = await supabase.from("games").insert(inserts);
    setSubmitting(false);

    if (error) {
      toast({ title: "Import Failed", description: error.message, variant: "destructive" });
      return;
    }

    setImportDone(true);
    toast({ title: "Fixtures Imported", description: `${validRows.length} fixture(s) seamlessly imported.` });
  };

  const downloadTemplate = () => {
    const headers = [
      "round_number *", "round_name (optional)", "date *", "time *", "venue *", "pitch *", 
      "grade *", "home_team *", "away_team (Leave blank for bye)", "umpire_1", "umpire_2"
    ];

    const ws = XLSX.utils.aoa_to_sheet([headers]);
    ws["!cols"] = headers.map((h) => ({ wch: Math.max(h.length + 4, 14) }));

    if (!ws["!dataValidation"]) (ws as any)["!dataValidation"] = [];
    const validations: any[] = (ws as any)["!dataValidation"];
    const maxRows = 200;

    const addListValidation = (col: number, options: string[]) => {
      if (options.length === 0) return;
      const colLetter = XLSX.utils.encode_col(col);
      validations.push({
        sqref: `${colLetter}2:${colLetter}${maxRows}`,
        type: "list",
        formula1: `"${options.join(",")}"`,
      });
    };

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Fixture Import");

    // Allowed Values sheet
    const refHeaders = ["Venue – Pitch", "Grade", "Teams", "Clubs (for umpires)"];
    
    const pitchesList = pitches
      .filter(p => venues.some(v => v.id === p.venue_id && v.association_id === selectedAssociationId))
      .map(p => {
        const venue = venues.find(v => v.id === p.venue_id);
        return venue ? `${venue.name} – ${p.name}` : p.name;
      });
    const gradesList = allAssocDivisions;
    const teamsList = [...new Set(assocTeams.map(t => t.name.trim()))];
    const clubsList = assocClubs.map(c => c.name);

    const maxLen = Math.max(pitchesList.length, gradesList.length, teamsList.length, clubsList.length);
    const refData: string[][] = [refHeaders];
    for (let i = 0; i < maxLen; i++) {
      refData.push([
        pitchesList[i] || "",
        gradesList[i] || "",
        teamsList[i] || "",
        clubsList[i] || ""
      ]);
    }
    const refWs = XLSX.utils.aoa_to_sheet(refData);
    refWs["!cols"] = refHeaders.map((h) => ({ wch: Math.max(h.length + 4, 20) }));
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
          <h1 className="text-3xl font-bold tracking-tight">Bulk Fixture Import</h1>
          <p className="text-muted-foreground">Upload a spreadsheet to import fixtures</p>
        </div>
      </div>

      {/* Scope Block */}
      <Card>
        <CardHeader><CardTitle className="text-lg">Import Scope</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label>Association</Label>
              <Select value={selectedAssociationId} onValueChange={setSelectedAssociationId} disabled={!isSuperAdmin && scopedAssociationIds.length <= 1}>
                <SelectTrigger><SelectValue placeholder="Select association" /></SelectTrigger>
                <SelectContent>
                  {availableAssociations.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Association bounds teams and grade selections.
          </p>
        </CardContent>
      </Card>

      {/* Upload card */}
      <Card>
        <CardHeader><CardTitle className="text-lg">Upload Spreadsheet</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4 flex-wrap">
            <Label htmlFor="fixture-upload" className={`flex items-center gap-2 px-4 py-2 border border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors ${!selectedAssociationId && 'opacity-50 pointer-events-none'}`}>
              <Upload className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">Choose .xlsx or .csv file</span>
            </Label>
            <Input key={fileKey} id="fixture-upload" type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileUpload} disabled={!selectedAssociationId} />
            <Button variant="outline" size="sm" onClick={downloadTemplate} disabled={!selectedAssociationId}>
              <Download className="h-4 w-4 mr-1" />
              Download Template
            </Button>
            {fileName && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <FileSpreadsheet className="h-4 w-4" />
                {fileName}
                <button
                  onClick={() => { setFileName(""); setRows([]); setImportDone(false); setFileKey(k => k + 1); }}
                  className="ml-1 text-muted-foreground hover:text-destructive"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Preview Table */}
      {rows.length > 0 && !importDone && (
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
                    <TableHead>Round Name</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Venue</TableHead>
                    <TableHead>Pitch</TableHead>
                    <TableHead>Grade</TableHead>
                    <TableHead>Home Team</TableHead>
                    <TableHead>Away Team</TableHead>
                    <TableHead>Umpire 1</TableHead>
                    <TableHead>Umpire 2</TableHead>
                    <TableHead>Bye</TableHead>
                    <TableHead className="w-48">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.row_number} className={r.errors.length > 0 ? "bg-destructive/5" : ""}>
                      <TableCell className="font-mono text-xs">{r.row_number}</TableCell>
                      <TableCell className="text-xs">{r.round_number}</TableCell>
                      <TableCell className="text-xs">{r.round_name}</TableCell>
                      <TableCell className="text-xs whitespace-nowrap">{r.date}</TableCell>
                      <TableCell className="text-xs">{r.time}</TableCell>
                      <TableCell className="text-xs">{r.venue}</TableCell>
                      <TableCell className="text-xs">{r.pitch}</TableCell>
                      <TableCell className="text-xs">{r.grade}</TableCell>
                      <TableCell className="text-xs">{r.home_team}</TableCell>
                      <TableCell className="text-xs">{r.away_team}</TableCell>
                      <TableCell className="text-xs">{r.is_bye ? "—" : r.umpire_1}</TableCell>
                      <TableCell className="text-xs">{r.is_bye ? "—" : r.umpire_2}</TableCell>
                      <TableCell className="text-xs">{r.is_bye ? "Yes" : "No"}</TableCell>
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

      {/* Action Button / Result */}
      {importDone ? (
        <Card>
          <CardContent className="py-6 text-center">
            <CheckCircle2 className="h-8 w-8 text-green-600 mx-auto mb-2" />
            <p className="font-medium">{validRows.length} fixture(s) imported successfully!</p>
            <Button variant="link" onClick={() => navigate("/admin/fixtures")}>View Fixtures</Button>
          </CardContent>
        </Card>
      ) : (
        rows.length > 0 && (
          <Button className="w-full" size="lg" disabled={submitting || validRows.length === 0} onClick={handleSubmit}>
            {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
            {submitting ? "Importing..." : `Import ${validRows.length} Fixture(s)`}
          </Button>
        )
      )}
    </div>
  );
};

export default FixtureImport;
