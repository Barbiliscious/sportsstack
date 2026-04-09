import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useNavigate, Link } from "react-router-dom";
import { Plus, Pencil, Trash2, Building2, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAdminScope } from "@/hooks/useAdminScope";
import type { Database } from "@/integrations/supabase/types";

type Association = Database["public"]["Tables"]["associations"]["Row"];

const AssociationsManagement = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { loading: scopeLoading, isSuperAdmin, isAnyAdmin, scopedAssociationIds, canManageAssociation } = useAdminScope();
  
  const [associations, setAssociations] = useState<Association[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAssociation, setEditingAssociation] = useState<Association | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingAssociation, setDeletingAssociation] = useState<Association | null>(null);
  const [formData, setFormData] = useState({ name: "", abbreviation: "", logo_url: "" });
  const [saving, setSaving] = useState(false);

  // Only SUPER_ADMIN and ASSOCIATION_ADMIN should see this page
  const hasAccess = isSuperAdmin || scopedAssociationIds.length > 0;

  useEffect(() => {
    if (!scopeLoading && !hasAccess) {
      navigate("/admin");
    }
  }, [scopeLoading, hasAccess, navigate]);

  const fetchAssociations = async () => {
    setLoading(true);
    if (isSuperAdmin) {
      const { data, error } = await supabase
        .from("associations")
        .select("*")
        .order("name");
      if (error) {
        toast({ title: "Error", description: "Failed to load associations", variant: "destructive" });
      } else {
        setAssociations(data || []);
      }
    } else {
      const { data, error } = await supabase
        .from("associations")
        .select("*")
        .in("id", scopedAssociationIds)
        .order("name");
      if (error) {
        toast({ title: "Error", description: "Failed to load associations", variant: "destructive" });
      } else {
        setAssociations(data || []);
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!scopeLoading && hasAccess) {
      fetchAssociations();
    }
  }, [scopeLoading, hasAccess]);

  const handleOpenDialog = (association?: Association) => {
    if (association) {
      setEditingAssociation(association);
      setFormData({
        name: association.name,
        abbreviation: association.abbreviation || "",
        logo_url: association.logo_url || "",
      });
    } else {
      setEditingAssociation(null);
      setFormData({ name: "", abbreviation: "", logo_url: "" });
    }
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast({ title: "Error", description: "Name is required", variant: "destructive" });
      return;
    }

    setSaving(true);

    if (editingAssociation) {
      const { error } = await supabase
        .from("associations")
        .update({
          name: formData.name.trim(),
          abbreviation: formData.abbreviation.trim() || null,
          logo_url: formData.logo_url.trim() || null,
        })
        .eq("id", editingAssociation.id);

      if (error) {
        toast({ title: "Error", description: "Failed to update association", variant: "destructive" });
      } else {
        toast({ title: "Success", description: "Association updated" });
        setDialogOpen(false);
        fetchAssociations();
      }
    } else {
      const { error } = await supabase
        .from("associations")
        .insert({
          name: formData.name.trim(),
          abbreviation: formData.abbreviation.trim() || null,
          logo_url: formData.logo_url.trim() || null,
        });

      if (error) {
        toast({ title: "Error", description: "Failed to create association", variant: "destructive" });
      } else {
        toast({ title: "Success", description: "Association created" });
        setDialogOpen(false);
        fetchAssociations();
      }
    }

    setSaving(false);
  };

  const handleDelete = async () => {
    if (!deletingAssociation) return;

    const { error } = await supabase
      .from("associations")
      .delete()
      .eq("id", deletingAssociation.id);

    if (error) {
      toast({ title: "Error", description: "Failed to delete association. It may have clubs.", variant: "destructive" });
    } else {
      toast({ title: "Success", description: "Association deleted" });
      fetchAssociations();
    }

    setDeleteDialogOpen(false);
    setDeletingAssociation(null);
  };

  if (scopeLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  const canAdd = isSuperAdmin;
  const canEdit = (id: string) => canManageAssociation(id);
  const canDelete = isSuperAdmin;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/admin")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight">Associations</h1>
          <p className="text-muted-foreground">Manage sports associations</p>
        </div>
        {canAdd && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => handleOpenDialog()}>
                <Plus className="mr-2 h-4 w-4" />
                Add Association
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingAssociation ? "Edit Association" : "Add Association"}</DialogTitle>
                <DialogDescription>
                  {editingAssociation ? "Update the association details" : "Create a new association"}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Hockey Victoria"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="abbreviation">Abbreviation</Label>
                  <Input
                    id="abbreviation"
                    value={formData.abbreviation}
                    onChange={(e) => setFormData({ ...formData, abbreviation: e.target.value })}
                    placeholder="e.g., HV"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="logo_url">Logo URL</Label>
                  <Input
                    id="logo_url"
                    value={formData.logo_url}
                    onChange={(e) => setFormData({ ...formData, logo_url: e.target.value })}
                    placeholder="https://..."
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? "Saving..." : editingAssociation ? "Update" : "Create"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            All Associations
          </CardTitle>
          <CardDescription>{associations.length} association(s)</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : associations.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No associations yet. Create your first one!
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Abbreviation</TableHead>
                  <TableHead>Logo</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {associations.map((association) => (
                  <TableRow key={association.id}>
                    <TableCell className="font-medium">
                      <Link to={`/associations/${association.id}`} className="hover:underline text-primary">
                        {association.name}
                      </Link>
                    </TableCell>
                    <TableCell>{association.abbreviation || "-"}</TableCell>
                    <TableCell>
                      {association.logo_url ? (
                        <img src={association.logo_url} alt="" className="h-8 w-8 rounded object-cover" />
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {canEdit(association.id) && (
                        <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(association)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                      {canDelete && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setDeletingAssociation(association);
                            setDeleteDialogOpen(true);
                          }}
                        >
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

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Association?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{deletingAssociation?.name}". 
              All clubs and teams under this association must be deleted first.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AssociationsManagement;
