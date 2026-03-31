import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { useNavigate } from "react-router-dom";
import { Users, ArrowLeft, Shield, Search, Check, X, UserPlus, FileSpreadsheet, Download, RefreshCw } from "lucide-react";
import * as XLSX from "xlsx";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAdminScope } from "@/hooks/useAdminScope";
import { getRoleDisplayName, getRoleBadgeColor } from "@/hooks/useUserRole";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];
type Profile = Database["public"]["Tables"]["profiles"]["Row"];

interface Membership {
  id: string;
  team_id: string;
  status: string;
  membership_type: string;
  team_name?: string;
}

interface UserWithRoles extends Profile {
  roles: AppRole[];
  memberships: Membership[];
}

const ALL_ROLES: AppRole[] = ["PLAYER", "COACH", "TEAM_MANAGER", "CLUB_ADMIN", "ASSOCIATION_ADMIN", "SUPER_ADMIN"];

const UsersManagement = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { loading: scopeLoading, isSuperAdmin, isAnyAdmin, scopedTeamIds, scopedClubIds, scopedAssociationIds } = useAdminScope();

  const [users, setUsers] = useState<UserWithRoles[]>([]);
  const [teams, setTeams] = useState<{ id: string; name: string; club_id: string; division?: string | null }[]>([]);
  const [clubs, setClubs] = useState<{ id: string; name: string; association_id: string }[]>([]);
  const [associations, setAssociations] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [associationFilter, setAssociationFilter] = useState<string>("all");
  const [clubFilter, setClubFilter] = useState<string>("all");
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserWithRoles | null>(null);
  const [selectedRoles, setSelectedRoles] = useState<AppRole[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!scopeLoading && !isAnyAdmin) {
      navigate("/dashboard");
    }
  }, [scopeLoading, isAnyAdmin, navigate]);

  const fetchUsers = async () => {
    setLoading(true);

    // Fetch reference data
    const [teamsRes, clubsRes, assocRes] = await Promise.all([
      supabase.from("teams").select("id, name, club_id, division"),
      supabase.from("clubs").select("id, name, association_id"),
      supabase.from("associations").select("id, name"),
    ]);
    setTeams(teamsRes.data || []);
    setClubs(clubsRes.data || []);
    setAssociations(assocRes.data || []);

    const teamsList = teamsRes.data || [];
    const teamsToShow = isSuperAdmin ? teamsList.map((t) => t.id) : scopedTeamIds;

    // Fetch memberships for scoped teams
    let membershipsData: any[] = [];
    if (isSuperAdmin) {
      const { data } = await supabase.from("team_memberships").select("id, user_id, team_id, status, membership_type");
      membershipsData = data || [];
    } else if (teamsToShow.length > 0) {
      const { data } = await supabase.from("team_memberships").select("id, user_id, team_id, status, membership_type").in("team_id", teamsToShow);
      membershipsData = data || [];
    }

    // Get unique user IDs from memberships
    const memberUserIds = [...new Set(membershipsData.map((m) => m.user_id))];

    // Fetch profiles
    let profiles: Profile[] = [];
    if (isSuperAdmin) {
      const { data } = await supabase.from("profiles").select("*").order("first_name");
      profiles = data || [];
    } else if (memberUserIds.length > 0) {
      const { data } = await supabase.from("profiles").select("*").in("id", memberUserIds).order("first_name");
      profiles = data || [];
    }

    // Fetch roles
    const { data: userRoles } = await supabase.from("user_roles").select("user_id, role");

    // Build user list
    const usersWithRoles: UserWithRoles[] = profiles.map((profile) => ({
      ...profile,
      roles: (userRoles || []).filter((r) => r.user_id === profile.id).map((r) => r.role),
      memberships: membershipsData
        .filter((m) => m.user_id === profile.id)
        .map((m) => ({
          id: m.id,
          team_id: m.team_id,
          status: m.status,
          membership_type: m.membership_type,
          team_name: teamsList.find((t) => t.id === m.team_id)?.name,
        })),
    }));

    setUsers(usersWithRoles);
    setLoading(false);
  };

  useEffect(() => {
    if (!scopeLoading && isAnyAdmin) {
      fetchUsers();
    }
  }, [scopeLoading, isAnyAdmin, isSuperAdmin, scopedTeamIds]);

  // Filter users
  const filteredUsers = users.filter((user) => {
    const fullName = `${user.first_name || ""} ${user.last_name || ""}`.toLowerCase();
    if (!fullName.includes(searchQuery.toLowerCase())) return false;
    if (statusFilter !== "all") {
      if (statusFilter === "unassigned") {
        if (user.memberships.length > 0) return false;
      } else {
        if (!user.memberships.some((m) => m.status === statusFilter)) return false;
      }
    }
    if (associationFilter !== "all") {
      const assocTeamIds = teams
        .filter((t) => {
          const club = clubs.find((c) => c.id === t.club_id);
          return club?.association_id === associationFilter;
        })
        .map((t) => t.id);
      if (!user.memberships.some((m) => assocTeamIds.includes(m.team_id))) return false;
    }
    if (clubFilter !== "all") {
      const clubTeamIds = teams.filter((t) => t.club_id === clubFilter).map((t) => t.id);
      if (!user.memberships.some((m) => clubTeamIds.includes(m.team_id))) return false;
    }
    return true;
  });

  // Available associations and clubs for filter dropdowns (scoped)
  const availableAssociations = isSuperAdmin
    ? associations
    : associations.filter((a) => scopedAssociationIds.includes(a.id));

  const availableClubs = clubs.filter((c) => {
    if (associationFilter !== "all") return c.association_id === associationFilter;
    if (!isSuperAdmin) {
      return scopedClubIds.includes(c.id) || scopedAssociationIds.includes(c.association_id);
    }
    return true;
  });

  const handleExport = () => {
    if (filteredUsers.length === 0) return;

    const exportData = filteredUsers.map((user, index) => {
      const primaryMembership = user.memberships[0];
      const team = primaryMembership ? teams.find((t) => t.id === primaryMembership.team_id) : undefined;
      const club = team ? clubs.find((c) => c.id === team.club_id) : undefined;

      // Look up team details for division
      const fullTeam = team ? teams.find((t) => t.id === team.id) : undefined;

      return {
        "Registration #": index + 1,
        "First Name": user.first_name || "",
        "Last Name": user.last_name || "",
        "Email": "", // Email not in profiles table
        "Gender": user.gender || "",
        "Date of Birth": user.date_of_birth || "",
        "Hockey Vic Number": user.hockey_vic_number || "",
        "Phone": user.phone || "",
        "Suburb": user.suburb || "",
        "Club": club?.name || "",
        "Team": team?.name || "",
        "Division": (fullTeam as any)?.division || "",
        "Membership Status": primaryMembership?.status || "Unassigned",
        "Membership Type": primaryMembership?.membership_type || "",
        "Emergency Contact Name": user.emergency_contact_name || "",
        "Emergency Contact Phone": user.emergency_contact_phone || "",
        "Emergency Contact Relationship": user.emergency_contact_relationship || "",
      };
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Players");
    const today = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `players-export-${today}.xlsx`);
    toast({ title: "Export Complete", description: `${exportData.length} player(s) exported.` });
  };

  const handleApproveMembership = async (membershipId: string) => {
    const { error } = await supabase.from("team_memberships").update({ status: "APPROVED" }).eq("id", membershipId);
    if (error) {
      toast({ title: "Error", description: "Failed to approve", variant: "destructive" });
    } else {
      toast({ title: "Approved", description: "Membership approved" });
      fetchUsers();
    }
  };

  const handleDeclineMembership = async (membershipId: string) => {
    const { error } = await supabase.from("team_memberships").update({ status: "DECLINED" }).eq("id", membershipId);
    if (error) {
      toast({ title: "Error", description: "Failed to decline", variant: "destructive" });
    } else {
      toast({ title: "Declined", description: "Membership declined" });
      fetchUsers();
    }
  };

  const handleOpenRoleDialog = (user: UserWithRoles) => {
    setSelectedUser(user);
    setSelectedRoles([...user.roles]);
    setRoleDialogOpen(true);
  };

  const handleToggleRole = (role: AppRole) => {
    setSelectedRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  };

  // Determine which roles the current admin can assign
  const canAssignRole = (role: AppRole): boolean => {
    if (isSuperAdmin) return true;
    if (role === "SUPER_ADMIN") return false;
    if (scopedAssociationIds.length > 0) {
      // Association admin can assign up to CLUB_ADMIN
      return ["PLAYER", "COACH", "TEAM_MANAGER", "CLUB_ADMIN"].includes(role);
    }
    if (scopedClubIds.length > 0) {
      // Club admin can assign up to TEAM_MANAGER
      return ["PLAYER", "COACH", "TEAM_MANAGER"].includes(role);
    }
    // Team manager/coach - no role assignment
    return false;
  };

  const handleSaveRoles = async () => {
    if (!selectedUser) return;
    setSaving(true);

    const currentRoles = selectedUser.roles;
    const rolesToAdd = selectedRoles.filter((r) => !currentRoles.includes(r));
    const rolesToRemove = currentRoles.filter((r) => !selectedRoles.includes(r));

    for (const role of rolesToRemove) {
      const { error } = await supabase.from("user_roles").delete().eq("user_id", selectedUser.id).eq("role", role);
      if (error) {
        toast({ title: "Error", description: `Failed to remove ${role}`, variant: "destructive" });
        setSaving(false);
        return;
      }
    }

    for (const role of rolesToAdd) {
      // Build insert with scope
      const insertData: any = { user_id: selectedUser.id, role };
      if (role === "ASSOCIATION_ADMIN" && scopedAssociationIds.length > 0) {
        insertData.association_id = scopedAssociationIds[0];
      }
      if (role === "CLUB_ADMIN" && scopedClubIds.length > 0) {
        insertData.club_id = scopedClubIds[0];
      }
      if ((role === "TEAM_MANAGER" || role === "COACH") && scopedTeamIds.length > 0) {
        insertData.team_id = scopedTeamIds[0];
      }

      const { error } = await supabase.from("user_roles").insert(insertData);
      if (error) {
        toast({ title: "Error", description: `Failed to add ${role}`, variant: "destructive" });
        setSaving(false);
        return;
      }
    }

    toast({ title: "Success", description: "User roles updated" });
    setRoleDialogOpen(false);
    fetchUsers();
    setSaving(false);
  };

  if (scopeLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/admin")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight">Users</h1>
          <p className="text-muted-foreground">Manage user profiles, roles, and memberships</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => navigate("/admin/bulk-import")}>
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Bulk Import
          </Button>
          <Button variant="outline" onClick={handleExport} disabled={filteredUsers.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button onClick={() => navigate("/admin/add-player")}>
            <UserPlus className="h-4 w-4 mr-2" />
            Add Player
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="PENDING">Pending</SelectItem>
            <SelectItem value="APPROVED">Approved</SelectItem>
            <SelectItem value="DECLINED">Declined</SelectItem>
            {isSuperAdmin && <SelectItem value="unassigned">Unassigned</SelectItem>}
          </SelectContent>
        </Select>
        <Select value={associationFilter} onValueChange={(v) => { setAssociationFilter(v); setClubFilter("all"); }}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Association" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Associations</SelectItem>
            {availableAssociations.map((a) => (
              <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={clubFilter} onValueChange={setClubFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Club" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Clubs</SelectItem>
            {availableClubs.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Users
          </CardTitle>
          <CardDescription>{filteredUsers.length} user(s)</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No users found.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Player Status</TableHead>
                  <TableHead>Team(s)</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Roles</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">
                      {user.first_name || user.last_name
                        ? `${user.first_name || ""} ${user.last_name || ""}`.trim()
                        : "(No name)"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={
                          (user as any).status === "Suspended"
                            ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300"
                            : (user as any).status === "Inactive"
                            ? "bg-muted text-muted-foreground"
                            : "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"
                        }
                      >
                        {(user as any).status || "Active"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {user.memberships.length === 0 ? (
                          <span className="text-muted-foreground text-sm">Unassigned</span>
                        ) : (
                          user.memberships.map((m) => (
                            <Badge key={m.id} variant="outline" className="text-xs">
                              {m.team_name || "Unknown"}
                            </Badge>
                          ))
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {user.memberships.length === 0 ? (
                          <span className="text-muted-foreground text-sm">-</span>
                        ) : (
                          user.memberships.map((m) => (
                            <div key={m.id} className="flex items-center gap-1">
                              <Badge
                                variant="secondary"
                                className={
                                  m.status === "PENDING"
                                    ? "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300"
                                    : m.status === "APPROVED"
                                    ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"
                                    : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300"
                                }
                              >
                                {m.status}
                              </Badge>
                              {m.status === "PENDING" && (
                                <div className="flex gap-0.5">
                                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleApproveMembership(m.id)}>
                                    <Check className="h-3 w-3 text-green-600" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleDeclineMembership(m.id)}>
                                    <X className="h-3 w-3 text-destructive" />
                                  </Button>
                                </div>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {user.roles.length === 0 ? (
                          <span className="text-muted-foreground text-sm">No roles</span>
                        ) : (
                          user.roles.map((role) => (
                            <Badge key={role} className={getRoleBadgeColor(role)} variant="secondary">
                              {getRoleDisplayName(role)}
                            </Badge>
                          ))
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" onClick={() => handleOpenRoleDialog(user)}>
                        <Shield className="mr-2 h-4 w-4" />
                        Roles
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Role Management Dialog */}
      <Dialog open={roleDialogOpen} onOpenChange={setRoleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manage Roles</DialogTitle>
            <DialogDescription>
              Update roles for {selectedUser?.first_name} {selectedUser?.last_name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {ALL_ROLES.map((role) => {
              const disabled = !canAssignRole(role);
              return (
                <div key={role} className="flex items-center space-x-3">
                  <Checkbox
                    id={role}
                    checked={selectedRoles.includes(role)}
                    onCheckedChange={() => handleToggleRole(role)}
                    disabled={disabled}
                  />
                  <Label htmlFor={role} className={`flex items-center gap-2 ${disabled ? "text-muted-foreground" : ""}`}>
                    <Badge className={getRoleBadgeColor(role)} variant="secondary">
                      {getRoleDisplayName(role)}
                    </Badge>
                    {disabled && <span className="text-xs">(insufficient permissions)</span>}
                  </Label>
                </div>
              );
            })}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRoleDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveRoles} disabled={saving}>
              {saving ? "Saving..." : "Save Roles"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UsersManagement;
