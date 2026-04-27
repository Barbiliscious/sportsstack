import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Users, Loader2, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface SetPrimaryTeamDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentPrimaryTeamId?: string;
  currentPrimaryTeamName?: string;
  existingTeamIds?: string[];
  onConfirm: (teamId: string) => Promise<void>;
  isChangingPrimary: boolean;
}

export const SetPrimaryTeamDialog = ({
  open,
  onOpenChange,
  currentPrimaryTeamId,
  currentPrimaryTeamName,
  existingTeamIds = [],
  onConfirm,
  isChangingPrimary,
}: SetPrimaryTeamDialogProps) => {
  const [associations, setAssociations] = useState<{ id: string; name: string }[]>([]);
  const [clubs, setClubs] = useState<{ id: string; name: string }[]>([]);
  const [teams, setTeams] = useState<{ id: string; name: string; division: string | null }[]>([]);

  const [selectedAssociation, setSelectedAssociation] = useState("");
  const [selectedClub, setSelectedClub] = useState("");
  const [selectedTeam, setSelectedTeam] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Fetch associations when dialog opens
  useEffect(() => {
    if (!open) return;
    supabase.from("associations").select("id, name").order("name").then(({ data }) => {
      setAssociations(data || []);
    });
  }, [open]);

  // Fetch clubs when association changes
  useEffect(() => {
    if (!selectedAssociation) { setClubs([]); setSelectedClub(""); return; }
    supabase.from("clubs").select("id, name").eq("association_id", selectedAssociation).order("name").then(({ data }) => {
      setClubs(data || []);
      setSelectedClub("");
      setSelectedTeam("");
    });
  }, [selectedAssociation]);

  // Fetch teams when club changes
  useEffect(() => {
    if (!selectedClub) { setTeams([]); setSelectedTeam(""); return; }
    supabase.from("teams").select("id, name, division").eq("club_id", selectedClub).order("name").then(({ data }) => {
      // Exclude current primary team
      const filtered = (data || []).filter((t) => t.id !== currentPrimaryTeamId);
      setTeams(filtered);
      setSelectedTeam("");
    });
  }, [selectedClub, currentPrimaryTeamId]);

  const handleClose = () => {
    setSelectedAssociation("");
    setSelectedClub("");
    setSelectedTeam("");
    onOpenChange(false);
  };

  const handleSubmit = async () => {
    if (!selectedTeam) return;
    setIsLoading(true);
    try {
      await onConfirm(selectedTeam);
      handleClose();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isChangingPrimary ? "Request Primary Team Change" : "Set Primary Team"}
          </DialogTitle>
          <DialogDescription>
            {isChangingPrimary
              ? "Select your new primary team. Your request will be sent to the team coach and club admin for approval."
              : "Select a team to set as your primary team. Your request will need to be approved."}
          </DialogDescription>
        </DialogHeader>

        {/* Warning when changing existing primary team */}
        {isChangingPrimary && currentPrimaryTeamName && (
          <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
            <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-amber-500">Warning</p>
              <p className="text-sm text-amber-500/90">
                If approved, your current primary team{" "}
                <span className="font-semibold">{currentPrimaryTeamName}</span> will be removed.
              </p>
            </div>
          </div>
        )}

        <div className="space-y-4 py-2">
          {/* Association */}
          <div className="space-y-2">
            <Label>Association</Label>
            <Select value={selectedAssociation} onValueChange={setSelectedAssociation}>
              <SelectTrigger>
                <SelectValue placeholder="Select association" />
              </SelectTrigger>
              <SelectContent>
                {associations.map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Club — only shows after association selected */}
          {selectedAssociation && (
            <div className="space-y-2">
              <Label>Club</Label>
              <Select value={selectedClub} onValueChange={setSelectedClub}>
                <SelectTrigger>
                  <SelectValue placeholder="Select club" />
                </SelectTrigger>
                <SelectContent>
                  {clubs.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Team — only shows after club selected */}
          {selectedClub && (
            <div className="space-y-2">
              <Label>Team</Label>
              {teams.length === 0 ? (
                <div className="py-4 text-center">
                  <Users className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No available teams in this club</p>
                </div>
              ) : (
                <Select value={selectedTeam} onValueChange={setSelectedTeam}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select team" />
                  </SelectTrigger>
                  <SelectContent>
                    {teams.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}{t.division && ` (${t.division})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!selectedTeam || isLoading}>
            {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {isChangingPrimary ? "Submit Request" : "Set as Primary"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};