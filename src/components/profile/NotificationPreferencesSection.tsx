import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Bell } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface Preference {
  channel: string;
  category: string;
  enabled: boolean;
}

const CATEGORIES = [
  { key: "game_reminders", label: "Game Reminders" },
  { key: "availability", label: "Availability Requests" },
  { key: "lineup", label: "Lineup Published" },
  { key: "team_updates", label: "Team Updates" },
  { key: "chat", label: "Chat Messages" },
];

const CHANNELS = [
  { key: "in_app", label: "In-App" },
  { key: "email", label: "Email" },
];

export function NotificationPreferencesSection() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [prefs, setPrefs] = useState<Preference[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetchPrefs = async () => {
      const { data } = await supabase
        .from("notification_preferences")
        .select("channel, category, enabled")
        .eq("user_id", user.id);

      if (data && data.length > 0) {
        setPrefs(data);
      } else {
        // Initialize defaults
        const defaults: Preference[] = [];
        for (const cat of CATEGORIES) {
          for (const ch of CHANNELS) {
            defaults.push({ channel: ch.key, category: cat.key, enabled: true });
          }
        }
        setPrefs(defaults);
      }
      setLoading(false);
    };
    fetchPrefs();
  }, [user]);

  const togglePref = async (channel: string, category: string) => {
    if (!user) return;

    const current = prefs.find((p) => p.channel === channel && p.category === category);
    const newEnabled = !(current?.enabled ?? true);

    setPrefs((prev) =>
      prev.map((p) =>
        p.channel === channel && p.category === category ? { ...p, enabled: newEnabled } : p
      )
    );

    const { error } = await supabase
      .from("notification_preferences")
      .upsert(
        { user_id: user.id, channel, category, enabled: newEnabled },
        { onConflict: "user_id,channel,category" }
      );

    if (error) {
      toast({ title: "Error", description: "Failed to update preference", variant: "destructive" });
      // revert
      setPrefs((prev) =>
        prev.map((p) =>
          p.channel === channel && p.category === category ? { ...p, enabled: !newEnabled } : p
        )
      );
    }
  };

  const isEnabled = (channel: string, category: string) =>
    prefs.find((p) => p.channel === channel && p.category === category)?.enabled ?? true;

  if (loading) {
    return <Skeleton className="h-48 w-full" />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Bell className="h-5 w-5" />
          Notification Preferences
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="grid grid-cols-[1fr_auto_auto] gap-x-6 gap-y-3 items-center">
            <div />
            {CHANNELS.map((ch) => (
              <Label key={ch.key} className="text-xs text-muted-foreground text-center">
                {ch.label}
              </Label>
            ))}
            {CATEGORIES.map((cat) => (
              <>
                <Label key={cat.key} className="text-sm font-medium">
                  {cat.label}
                </Label>
                {CHANNELS.map((ch) => (
                  <div key={`${cat.key}-${ch.key}`} className="flex justify-center">
                    <Switch
                      checked={isEnabled(ch.key, cat.key)}
                      onCheckedChange={() => togglePref(ch.key, cat.key)}
                    />
                  </div>
                ))}
              </>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
