import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertTriangle,
  Download,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAdminScope } from "@/hooks/useAdminScope";
import { supabase } from "@/integrations/supabase/client";
import * as XLSX from "xlsx";

interface ParsedRow {
  row_number: number;
  first_name: string;
  last_name: string;
  email: string;
  gender: string;
  date_of_birth: string;
  hockey_vic_number: string;
  club_name: string;
  division: string;
  phone: string;
  suburb: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  emergency_contact_relationship: string;
  is_primary_team: boolean;
  errors: string[];
  team_id: string | null;
}

interface ImportResult {
  created: number;
  added: number;
  errors: Array<{ row: number; error: string }>;
}

const EXPECTED_HEADERS = [
  "first_name",
  "last_name",
  "email",
  "gender",
  "date_of_birth",
  "hockey_vic_number",
  "club_name",
  "division",
  "phone",
  "suburb",
];

const BulkImport = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { loading: scopeLoading, isAnyAdmin, isSuperAdmin, scopedAssociationIds } = useAdminScope();
  const [submitting, setSubmitting] = useState(false);
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  // Association scope selector
  const [associations, setAssociations] = useState<{ id: string; name: string }[]>([]);
  const [clubs, setClubs] = useState<{ id: string; name: string; association_id: string }[]>([]);
  const [teams, setTeams] = useState<{ id: string; name: string; club_id: string; division: string | null }[]>([]);
  const [selectedAssociationId, setSelectedAssociationId] = useState("");

  useEffect(() => {
    if (!scopeLoading && !isAnyAdmin) navigate("/dashboard");
  }, [scopeLoading, isAnyAdmin, navigate]);

  // Load reference data
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

  // Auto-lock association if only one in scope
  useEffect(() => {
    if (scopeLoading) return;
    if (!isSuperAdmin && scopedAssociationIds.length === 1) {
      setSelectedAssociationId(scopedAssociationIds[0]);
    }
  }, [scopeLoading, isSuperAdmin, scopedAssociationIds]);

  const availableAssociations = isSuperAdmin
    ? associations
    : associations.filter((a) => scopedAssociationIds.includes(a.id));

  // Build lookup map: (club_name_lower, division_lower) -> team_id
  const teamLookup = useMemo(() => {
    if (!selectedAssociationId) return new Map<string, string>();
    const assocClubs = clubs.filter((c) => c.association_id === selectedAssociationId);
    const assocClubIds = new Set(assocClubs.map((c) => c.id));
    const assocTeams = teams.filter((t) => assocClubIds.has(t.club_id));

    const map = new Map<string, string>();
    for (const team of assocTeams) {
      const club = assocClubs.find((c) => c.id === team.club_id);
      if (club && team.division) {
        const key = `${club.name.toLowerCase().trim()}|${team.division.toLowerCase().trim()}`;
        map.set(key, team.id);
      }
    }
    return map;
  }, [selectedAssociationId, clubs, teams]);

  const validateRows = useCallback(
    (parsed: Omit<ParsedRow, "errors" | "team_id">[]): ParsedRow[] => {
      return parsed.map((r) => {
        const errors: string[] = [];
        if (!r.first_name.trim()) errors.push("First name required");
        if (!r.last_name.trim()) errors.push("Last name required");
        if (!r.email.trim()) errors.push("Email required");

        let team_id: string | null = null;
        if (r.club_name && r.division) {
          const key = `${r.club_name.toLowerCase().trim()}|${r.division.toLowerCase().trim()}`;
          const found = teamLookup.get(key);
          if (found) {
            team_id = found;
          } else {
            errors.push("Club/Division not found");
          }
        } else if (!r.club_name && !r.division) {
          errors.push("Club and Division required");
        } else {
          errors.push("Both Club and Division required");
        }

        return { ...r, errors, team_id };
      });
    },
    [teamLookup]
  );

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setImportResult(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

        const parsed = json.map((row, i) => {
          // Convert DD/MM/YYYY to YYYY-MM-DD
          let dob = String(row["date_of_birth"] || row["DOB"] || row["Date of Birth"] || "").trim();
          if (dob && dob.includes("/")) {
            const parts = dob.split("/");
            if (parts.length === 3) {
              dob = `${parts[2]}-${parts[1]}-${parts[0]}`;
            }
          }

          const isPrimaryRaw = String(row["is_primary_team"] || row["Is Primary Team"] || "").trim().toLowerCase();

          return {
            row_number: i + 2,
            first_name: String(row["first_name"] || row["First Name"] || row["FirstName"] || "").trim(),
            last_name: String(row["last_name"] || row["Last Name"] || row["LastName"] || "").trim(),
            email: String(row["email"] || row["Email"] || "").trim(),
            gender: String(row["gender"] || row["Gender"] || "").trim(),
            date_of_birth: dob,
            hockey_vic_number: String(row["hockey_vic_number"] || row["HV Number"] || row["HV_Number"] || "").trim(),
            club_name: String(row["club_name"] || row["Club"] || row["Club Name"] || row["club"] || "").trim(),
            division: String(row["division"] || row["Division"] || row["Comp"] || row["competition"] || "").trim(),
            phone: String(row["phone"] || row["Phone"] || "").trim(),
            suburb: String(row["suburb"] || row["Suburb"] || row["Address"] || "").trim(),
            emergency_contact_name: String(row["emergency_contact_name"] || row["Emergency Contact Name"] || row["EC Name"] || "").trim(),
            emergency_contact_phone: String(row["emergency_contact_phone"] || row["Emergency Contact Phone"] || row["EC Phone"] || "").trim(),
            emergency_contact_relationship: String(row["emergency_contact_relationship"] || row["Emergency Contact Relationship"] || row["EC Relationship"] || "").trim(),
            is_primary_team: isPrimaryRaw === "yes" || isPrimaryRaw === "true" || isPrimaryRaw === "1",
          };
        });

        setRows(validateRows(parsed));
      } catch {
        toast({ title: "Parse Error", description: "Could not read the spreadsheet file.", variant: "destructive" });
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Re-validate when association changes
  useEffect(() => {
    if (rows.length > 0) {
      setRows((prev) =>
        validateRows(
          prev.map(({ errors, team_id, ...rest }) => rest)
        )
      );
    }
  }, [teamLookup]);

  const validRows = rows.filter((r) => r.errors.length === 0);
  const errorRows = rows.filter((r) => r.errors.length > 0);

  const handleSubmit = async () => {
    if (validRows.length === 0) {
      toast({ title: "No Valid Rows", description: "Fix errors before importing.", variant: "destructive" });
      return;
    }
    if (!selectedAssociationId) {
      toast({ title: "No Association", description: "Select an association first.", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    const { data, error } = await supabase.functions.invoke("bulk-import", {
      body: {
        association_id: selectedAssociationId,
        players: validRows.map((r) => ({
          first_name: r.first_name,
          last_name: r.last_name,
          email: r.email || null,
          gender: r.gender || null,
          date_of_birth: r.date_of_birth || null,
          hockey_vic_number: r.hockey_vic_number || null,
          phone: r.phone || null,
          suburb: r.suburb || null,
          emergency_contact_name: r.emergency_contact_name || null,
          emergency_contact_phone: r.emergency_contact_phone || null,
          emergency_contact_relationship: r.emergency_contact_relationship || null,
          team_id: r.team_id,
          row_number: r.row_number,
        })),
      },
    });
    setSubmitting(false);

    if (error || data?.error) {
      toast({
        title: "Import Failed",
        description: data?.error || error?.message || "Unknown error",
        variant: "destructive",
      });
      return;
    }

    setImportResult(data as ImportResult);
    toast({
      title: "Import Complete",
      description: `${data.created} player(s) created. ${data.errors?.length || 0} failed.`,
    });
  };

  if (scopeLoading) return null;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/admin/users")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Bulk Player Import</h1>
          <p className="text-muted-foreground">Upload a spreadsheet to create multiple players at once</p>
        </div>
      </div>

      {/* Association Scope */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Import Scope</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-w-sm">
            <Label>Association</Label>
            <Select
              value={selectedAssociationId}
              onValueChange={(v) => {
                setSelectedAssociationId(v);
              }}
              disabled={!isSuperAdmin && scopedAssociationIds.length <= 1}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select association" />
              </SelectTrigger>
              <SelectContent>
                {availableAssociations.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Club and Division columns in your spreadsheet will be matched to teams within this association.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* File Upload */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Upload Spreadsheet</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4 flex-wrap">
            <Label
              htmlFor="file-upload"
              className="flex items-center gap-2 px-4 py-2 border border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
            >
              <Upload className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">Choose .xlsx or .csv file</span>
            </Label>
            <Input
              id="file-upload"
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={handleFileUpload}
              disabled={!selectedAssociationId}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                const headers = [
                  "first_name", "last_name", "email", "phone", "suburb",
                  "date_of_birth", "gender", "hockey_vic_number",
                  "emergency_contact_name", "emergency_contact_phone", "emergency_contact_relationship",
                  "association", "club", "competition", "team_name",
                  "is_primary_team", "jersey_number", "position", "role", "notes",
                ];
                const ws = XLSX.utils.aoa_to_sheet([headers]);
                // Set column widths
                ws["!cols"] = headers.map((h) => ({ wch: Math.max(h.length + 4, 14) }));
                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, "Players");
                XLSX.writeFile(wb, "player_import_template.xlsx");
              }}
            >
              <Download className="h-4 w-4 mr-1" />
              Download Template
            </Button>
            {fileName && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <FileSpreadsheet className="h-4 w-4" />
                {fileName}
              </div>
            )}
          </div>
          <div className="text-xs text-muted-foreground space-y-1">
            <p>Expected columns: <span className="font-mono">first_name, last_name, email, gender, date_of_birth, hockey_vic_number, club_name, division, phone, suburb, emergency_contact_name, emergency_contact_phone, emergency_contact_relationship</span></p>
            <p>Also accepts: First Name, Last Name, Email, Gender, DOB, HV Number, Club, Division, Phone, Suburb/Address, EC Name, EC Phone, EC Relationship</p>
          </div>
        </CardContent>
      </Card>

      {/* Preview Table */}
      {rows.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">
              Preview ({rows.length} rows)
            </CardTitle>
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="text-green-600 border-green-300">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                {validRows.length} valid
              </Badge>
              {errorRows.length > 0 && (
                <Badge variant="outline" className="text-destructive border-destructive/30">
                  <XCircle className="h-3 w-3 mr-1" />
                  {errorRows.length} errors
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
                    <TableHead>First Name</TableHead>
                    <TableHead>Last Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Gender</TableHead>
                    <TableHead>DOB</TableHead>
                    <TableHead>HV #</TableHead>
                    <TableHead>Club</TableHead>
                    <TableHead>Division</TableHead>
                    <TableHead className="w-24">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow
                      key={r.row_number}
                      className={r.errors.length > 0 ? "bg-destructive/5" : ""}
                    >
                      <TableCell className="font-mono text-xs">{r.row_number}</TableCell>
                      <TableCell>{r.first_name}</TableCell>
                      <TableCell>{r.last_name}</TableCell>
                      <TableCell className="text-xs">{r.email || <span className="text-destructive italic">missing</span>}</TableCell>
                      <TableCell>{r.gender}</TableCell>
                      <TableCell className="text-xs">{r.date_of_birth}</TableCell>
                      <TableCell className="text-xs">{r.hockey_vic_number}</TableCell>
                      <TableCell>{r.club_name}</TableCell>
                      <TableCell>{r.division}</TableCell>
                      <TableCell>
                        {r.errors.length === 0 ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                        ) : (
                          <div className="flex items-center gap-1" title={r.errors.join("; ")}>
                            <XCircle className="h-4 w-4 text-destructive" />
                            <span className="text-xs text-destructive truncate max-w-[120px]">
                              {r.errors[0]}
                            </span>
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

      {/* Import Result */}
      {importResult && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              Import Results
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm">
              <span className="font-semibold text-green-600">{importResult.created}</span> player(s) created successfully.
            </p>
            {importResult.errors.length > 0 && (
              <div className="space-y-1">
                <p className="text-sm font-medium text-destructive flex items-center gap-1">
                  <AlertTriangle className="h-4 w-4" />
                  {importResult.errors.length} row(s) failed:
                </p>
                <ul className="text-xs space-y-1 pl-5 list-disc text-muted-foreground">
                  {importResult.errors.map((e, i) => (
                    <li key={i}>Row {e.row}: {e.error}</li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Submit */}
      {rows.length > 0 && !importResult && (
        <Button
          className="w-full"
          size="lg"
          disabled={submitting || validRows.length === 0}
          onClick={handleSubmit}
        >
          {submitting ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Upload className="h-4 w-4 mr-2" />
          )}
          {submitting ? "Importing..." : `Import ${validRows.length} Player(s)`}
        </Button>
      )}
    </div>
  );
};

export default BulkImport;
