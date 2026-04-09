import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useNavigate, Link } from "react-router-dom";
import { Plus, Pencil, Trash2, Shield, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAdminScope } from "@/hooks/useAdminScope";
import type { Database } from "@/integrations/supabase/types";

type Club = Database["public"]["Tables"]["clubs"]["Row"];
type Association = Database["public"]["Tables"]["associations"]["Row"];

interface ClubWithAssociation extends Club {
  associations: { name: string } | null;
}

const ClubsManagement = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { loading: scopeLoading, isSuperAdmin, isAnyAdmin, scopedClubIds, scopedAssociationIds, canManageClub } = useAdminScope();

  const hasAccess = isSuperAdmin || scopedAssociationIds.length > 0 || scopedClubIds.length > 0;

  const [clubs, setClubs] = useState<ClubWithAssociation[]>([]);
  const [associations, setAssociations] = useState<Association[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterAssociation, setFilterAssociation] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingClub, setEditingClub] = useState<ClubWithAssociation | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingClub, setDeletingClub] = useState<ClubWithAssociation | null>(null);
  const [formData, setFormData] = useState({ name: "", abbreviation: "", logo_url: "", association_id: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!scopeLoading && !hasAccess) {
      navigate("/admin");
    }
  }, [scopeLoading, hasAccess, navigate]);

  const fetchData = async () => {
    setLoading(true);

    let clubsQuery = supabase.from("clubs").select("*, associations:association_id(name)").order("name");
    if (!isSuperAdmin && scopedClubIds.length > 0) {
      clubsQuery = clubsQuery.in("id", scopedClubIds);
    }

    const [clubsRes, associationsRes] = await Promise.all([
      clubsQuery,
      supabase.from("associations").select("*").order("name"),
    ]);

    if (clubsRes.error) {
      toast({ title: "Error", description: "Failed to load clubs", variant: "destructive" });
    } else {
      setClubs(clubsRes.data || []);
    }
    if (!associationsRes.error) setAssociations(associationsRes.data || []);
    setLoading(false);
  };

  useEffect(() => {
    if (!scopeLoading && hasAccess) fetchData();
  }, [scopeLoading, hasAccess]);

  const filteredClubs = filterAssociation === "all"
    ? clubs
    : clubs.filter((c) => c.association_id === filterAssociation);

  // Can add clubs if SUPER_ADMIN or ASSOCIATION_ADMIN
  const canAdd = isSuperAdmin || scopedAssociationIds.length > 0;
  const canDelete = isSuperAdmin || scopedAssociationIds.length > 0;

  // Available associations for form dropdown (scoped)
  const formAssociations = isSuperAdmin
    ? associations
    : associations.filter((a) => scopedAssociationIds.includes(a.id));

  const handleOpenDialog = (club?: ClubWithAssociation) => {
    if (club) {
      setEditingClub(club);
      setFormData({ name: club.name, abbreviation: club.abbreviation || "", logo_url: club.logo_url || "", association_id: club.association_id });
    } else {
      setEditingClub(null);
      setFormData({ name: "", abbreviation: "", logo_url: "", association_id: formAssociations.length === 1 ? formAssociations[0].id : "" });
    }
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim() || !formData.association_id) {
      toast({ title: "Error", description: "Name and Association are required", variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload = { name: formData.name.trim(), abbreviation: formData.abbreviation.trim() || null, logo_url: formData.logo_url.trim() || null, association_id: formData.association_id };

    if (editingClub) {
      const { error } = await supabase.from("clubs").update(payload).eq("id", editingClub.id);
      if (error) { toast({ title: "Error", description: "Failed to update club", variant: "destructive" }); }
      else { toast({ title: "Success", description: "Club updated" }); setDialogOpen(false); fetchData(); }
    } else {
      const { error } = await supabase.from("clubs").insert(payload);
      if (error) { toast({ title: "Error", description: "Failed to create club", variant: "destructive" }); }
      else { toast({ title: "Success", description: "Club created" }); setDialogOpen(false); fetchData(); }
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!deletingClub) return;
    const { error } = await supabase.from("clubs").delete().eq("id", deletingClub.id);
    if (error) { toast({ title: "Error", description: "Failed to delete club. It may have teams.", variant: "destructive" }); }
    else { toast({ title: "Success", description: "Club deleted" }); fetchData(); }
    setDeleteDialogOpen(false);
    setDeletingClub(null);
  };

  if (scopeLoading) {
    return <div className="space-y-6"><Skeleton className="h-10 w-64" /><Skeleton className="h-96" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/admin")}><ArrowLeft className="h-5 w-5" /></Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight">Clubs</h1>
          <p className="text-muted-foreground">Manage clubs within associations</p>
        </div>
        {canAdd && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => handleOpenDialog()}><Plus className="mr-2 h-4 w-4" />Add Club</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingClub ? "Edit Club" : "Add Club"}</DialogTitle>
                <DialogDescription>{editingClub ? "Update details" : "Create a new club"}</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Association *</Label>
                  <Select value={formData.association_id} onValueChange={(v) => setFormData({ ...formData, association_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select association" /></SelectTrigger>
                    <SelectContent>
                      {formAssociations.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Name *</Label>
                  <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="e.g., Melbourne HC" />
                </div>
                <div className="space-y-2">
                  <Label>Abbreviation</Label>
                  <Input value={formData.abbreviation} onChange={(e) => setFormData({ ...formData, abbreviation: e.target.value })} placeholder="e.g., MHC" />
                </div>
                <div className="space-y-2">
                  <Label>Logo URL</Label>
                  <Input value={formData.logo_url} onChange={(e) => setFormData({ ...formData, logo_url: e.target.value })} placeholder="https://..." />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleSave} disabled={saving}>{saving ? "Saving..." : editingClub ? "Update" : "Create"}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Filter */}
      {(isSuperAdmin || scopedAssociationIds.length > 1) && (
        <div className="flex items-center gap-4">
          <Label>Filter by Association:</Label>
          <Select value={filterAssociation} onValueChange={setFilterAssociation}>
            <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Associations</SelectItem>
              {(isSuperAdmin ? associations : associations.filter((a) => scopedAssociationIds.includes(a.id))).map((a) => (
                <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5" />Clubs</CardTitle>
          <CardDescription>{filteredClubs.length} club(s)</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : filteredClubs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No clubs found.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Association</TableHead>
                  <TableHead>Abbreviation</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredClubs.map((club) => (
                  <TableRow key={club.id}>
                    <TableCell className="font-medium">
                      <Link to={`/clubs/${club.id}`} className="hover:underline text-primary">
                        {club.name}
                      </Link>
                    </TableCell>
                    <TableCell>{club.associations?.name || "-"}</TableCell>
                    <TableCell>{club.abbreviation || "-"}</TableCell>
                    <TableCell className="text-right">
                      {canManageClub(club.id) && (
                        <Button variant="ghost" size="icon" onClick={() => { handleOpenDialog(club); setDialogOpen(true); }}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                      {canDelete && (
                        <Button variant="ghost" size="icon" onClick={() => { setDeletingClub(club); setDeleteDialogOpen(true); }}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Club?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete "{deletingClub?.name}". All teams must be deleted first.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ClubsManagement;
