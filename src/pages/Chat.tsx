import { useState, useRef, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Send, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTeamContext } from "@/contexts/TeamContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

interface ChatMessage {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  first_name: string | null;
  last_name: string | null;
}

const Chat = () => {
  const { selectedTeamId, selectedTeam, selectedClub } = useTeamContext();
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Fetch messages
  useEffect(() => {
    if (!selectedTeamId) {
      setMessages([]);
      setLoading(false);
      return;
    }

    const fetchMessages = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("team_messages")
        .select("id, user_id, content, created_at")
        .eq("team_id", selectedTeamId)
        .order("created_at", { ascending: true })
        .limit(100);

      if (data && data.length > 0) {
        const userIds = [...new Set(data.map((m) => m.user_id))];
        const { data: profiles } = await supabase
          .from("teammate_profiles")
          .select("id, first_name, last_name")
          .in("id", userIds);

        const enriched: ChatMessage[] = data.map((m) => {
          const profile = profiles?.find((p) => p.id === m.user_id);
          return {
            ...m,
            first_name: profile?.first_name || null,
            last_name: profile?.last_name || null,
          };
        });
        setMessages(enriched);
      } else {
        setMessages([]);
      }
      setLoading(false);
    };

    fetchMessages();

    // Subscribe to realtime
    const channel = supabase
      .channel(`team-chat-${selectedTeamId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "team_messages",
          filter: `team_id=eq.${selectedTeamId}`,
        },
        async (payload) => {
          const newMsg = payload.new as any;
          const { data: profile } = await supabase
            .from("profiles")
            .select("first_name, last_name")
            .eq("id", newMsg.user_id)
            .single();

          setMessages((prev) => [
            ...prev,
            {
              id: newMsg.id,
              user_id: newMsg.user_id,
              content: newMsg.content,
              created_at: newMsg.created_at,
              first_name: profile?.first_name || null,
              last_name: profile?.last_name || null,
            },
          ]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedTeamId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!newMessage.trim() || !user || !selectedTeamId) return;

    const content = newMessage.trim();
    setNewMessage("");

    const { error } = await supabase.from("team_messages").insert({
      team_id: selectedTeamId,
      user_id: user.id,
      content,
    });

    if (error) {
      console.error("Failed to send message:", error);
      setNewMessage(content); // Restore on error
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return date.toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit" });
    } else if (days === 1) {
      return "Yesterday";
    } else if (days < 7) {
      return date.toLocaleDateString("en-AU", { weekday: "short" });
    }
    return date.toLocaleDateString("en-AU", { month: "short", day: "numeric" });
  };

  const getSenderName = (msg: ChatMessage) => {
    if (msg.user_id === user?.id) return "You";
    return [msg.first_name, msg.last_name].filter(Boolean).join(" ") || "Unknown";
  };

  return (
    <div className="h-[calc(100vh-12rem)] md:h-[calc(100vh-8rem)] flex flex-col animate-fade-in">
      <div className="mb-4">
        <h1 className="font-display text-3xl md:text-4xl text-foreground">
          TEAM CHAT
        </h1>
        <p className="text-muted-foreground mt-1 flex items-center gap-2">
          <Users className="h-4 w-4" />
          {selectedTeam?.name || "Select a team"} {selectedClub ? `• ${selectedClub.name}` : ""}
        </p>
      </div>

      <Card className="flex-1 flex flex-col overflow-hidden">
        <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex gap-3">
                  <Skeleton className="w-9 h-9 rounded-full" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-10 w-48" />
                  </div>
                </div>
              ))}
            </div>
          ) : messages.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-muted-foreground text-sm">No messages yet. Start the conversation!</p>
            </div>
          ) : (
            messages.map((message) => {
              const isOwnMessage = message.user_id === user?.id;
              return (
                <div key={message.id} className={cn("flex gap-3", isOwnMessage && "flex-row-reverse")}>
                  <div
                    className={cn(
                      "w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0",
                      isOwnMessage ? "bg-accent text-accent-foreground" : "bg-primary text-primary-foreground"
                    )}
                  >
                    {(message.first_name || "?").charAt(0)}
                  </div>
                  <div className={cn("max-w-[75%]", isOwnMessage && "text-right")}>
                    <div className={cn("flex items-center gap-2 mb-1", isOwnMessage && "flex-row-reverse")}>
                      <span className="text-sm font-medium text-foreground">
                        {getSenderName(message)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatTime(message.created_at)}
                      </span>
                    </div>
                    <div
                      className={cn(
                        "rounded-2xl px-4 py-2.5 inline-block",
                        isOwnMessage
                          ? "bg-accent text-accent-foreground rounded-tr-sm"
                          : "bg-muted text-foreground rounded-tl-sm"
                      )}
                    >
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </CardContent>

        <div className="p-4 border-t border-border">
          <div className="flex gap-2">
            <Input
              placeholder="Type a message..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={handleKeyPress}
              className="flex-1"
              disabled={!selectedTeamId}
            />
            <Button onClick={handleSend} disabled={!newMessage.trim() || !selectedTeamId} size="icon">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default Chat;
