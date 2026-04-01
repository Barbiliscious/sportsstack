import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { CheckCircle2, XCircle, ClipboardList } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useAdminScope } from "@/hooks/useAdminScope";

interface RequestRow {
  id: string;
  user_id: string;
  from_team_id: string | null;
  to_team_id: string;
  status: string;
  requested_at: string;
  player_name: string;
  from_team_name: string | null;
  to_team_name: string;
}

const Requests = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const { isSuperAdmin, scopedClubIds, scopedAssociationIds } = useAdminScope();
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRequests = async () => {
    setLoading(true);

    const { data: raw, error } = await supabase
      .from("primary_change_requests")
      .select("id, user_id, from_team_id, to_team_id, status, requested_at")
      .eq("status", "PENDING")
      .order("requested_at", { ascending: false });

    if (error || !raw) {
      setRequests([]);
      setLoading(false);
      return;
    }

    // Gather unique IDs
    const userIds = [...new Set(raw.map((r) => r.user_id))];
    const teamIds = [...new Set(raw.flatMap((r) => [r.from_team_id, r.to_team_id].filter(Boolean) as string[]))];

    const [profilesRes, teamsRes] = await Promise.all([
      supabase.from("profiles").select("id, first_name, last_name").in("id", userIds),
      supabase.from("teams").select("id, name, club_id").in("id", teamIds),
    ]);

    const profileMap = new Map((profilesRes.data || []).map((p) => [p.id, `${p.first_name || ""} ${p.last_name || ""}`.trim() || "Unknown"]));
    const teamMap = new Map((teamsRes.data || []).map((t) => [t.id, t]));

    // Scope filtering
    let filtered = raw;
    if (!isSuperAdmin) {
      const { data: clubsData } = await supabase.from("clubs").select("id, association_id");
      const clubs = clubsData || [];
      const allowedClubIds = new Set<string>();

      for (const c of clubs) {
        if (scopedClubIds.includes(c.id)) allowedClubIds.add(c.id);
        if (scopedAssociationIds.includes(c.association_id)) allowedClubIds.add(c.id);
      }

      filtered = raw.filter((r) => {
        const toTeam = teamMap.get(r.to_team_id);
        return toTeam && allowedClubIds.has(toTeam.club_id);
      });
    }

    setRequests(
      filtered.map((r) => ({
        ...r,
        player_name: profileMap.get(r.user_id) || "Unknown",
        from_team_name: r.from_team_id ? teamMap.get(r.from_team_id)?.name || null : null,
        to_team_name: teamMap.get(r.to_team_id)?.name || "Unknown",
      }))
    );
    setLoading(false);
  };

  useEffect(() => {
    fetchRequests();
  }, [user]);

  const handleAction = async (id: string, userId: string, action: "ADMIN_APPROVED" | "DECLINED", toTeamName: string) => {
    const { error } = await supabase
      .from("primary_change_requests")
      .update({ status: action, resolved_at: new Date().toISOString(), resolved_by: user?.id || null })
      .eq("id", id);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }

    // Send notification to player
    await supabase.from("notifications").insert({
      user_id: userId,
      type: "primary_team_request",
      title: action === "ADMIN_APPROVED" ? "Primary Team Request Approved" : "Primary Team Request Declined",
      message: action === "ADMIN_APPROVED"
        ? `Your request to change primary team to ${toTeamName} has been approved. Please confirm the change on your profile.`
        : `Your request to change primary team to ${toTeamName} has been declined.`,
    });

    toast({ title: action === "ADMIN_APPROVED" ? "Approved" : "Declined", description: `Request ${action === "ADMIN_APPROVED" ? "approved" : "declined"}.` });
    fetchRequests();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Requests</h1>
        <p className="text-muted-foreground">Manage pending primary team change requests</p>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      ) : requests.length === 0 ? (
        <Card className="text-center py-12">
          <ClipboardList className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No pending requests</p>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{requests.length} Pending Request{requests.length !== 1 ? "s" : ""}</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Player</TableHead>
                  <TableHead>Current Primary</TableHead>
                  <TableHead>Requested Team</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.player_name}</TableCell>
                    <TableCell>{r.from_team_name || "None"}</TableCell>
                    <TableCell>{r.to_team_name}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      {new Date(r.requested_at).toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" })}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center gap-1 justify-end">
                        <Button size="sm" variant="default" className="h-8 gap-1" onClick={() => handleAction(r.id, r.user_id, "ADMIN_APPROVED", r.to_team_name)}>
                          <CheckCircle2 className="h-3 w-3" /> Accept
                        </Button>
                        <Button size="sm" variant="outline" className="h-8 gap-1 text-destructive" onClick={() => handleAction(r.id, r.user_id, "DECLINED", r.to_team_name)}>
                          <XCircle className="h-3 w-3" /> Decline
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Requests;
