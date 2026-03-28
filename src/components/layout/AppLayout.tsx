import { useState, useEffect } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { cn, getTeamDisplayName } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  LayoutDashboard,
  Calendar,
  BarChart3,
  MessageCircle,
  LogOut,
  Menu,
  X,
  Bell,
  User,
  ClipboardList,
  Users,
  UserCog,
  Settings,
  Building2,
  Shield,
  Globe,
  ChevronDown,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useTeamContext } from "@/contexts/TeamContext";
import { useAuth } from "@/contexts/AuthContext";
import { useAppMode, MODE_LABELS, type AppMode } from "@/contexts/AppModeContext";
import { supabase } from "@/integrations/supabase/client";

// Nav items per mode
const NAV_SETS: Record<AppMode, { path: string; label: string; icon: typeof LayoutDashboard }[]> = {
  super_admin: [
    { path: "/admin/associations", label: "Associations", icon: Globe },
    { path: "/admin/clubs", label: "Clubs", icon: Building2 },
    { path: "/admin/teams", label: "Teams", icon: Shield },
    { path: "/admin/fixtures", label: "Fixtures", icon: Calendar },
    { path: "/admin/users", label: "Users", icon: UserCog },
  ],
  association: [
    { path: "/admin/clubs", label: "Clubs", icon: Building2 },
    { path: "/admin/teams", label: "Teams", icon: Shield },
    { path: "/admin/fixtures", label: "Fixtures", icon: Calendar },
    { path: "/admin/users", label: "Users", icon: UserCog },
  ],
  club: [
    { path: "/admin/teams", label: "Teams", icon: Shield },
    { path: "/admin/fixtures", label: "Fixtures", icon: Calendar },
    { path: "/admin/users", label: "Users", icon: UserCog },
    { path: "/admin", label: "Club Settings", icon: Settings },
  ],
  team: [
    { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { path: "/games", label: "Fixtures", icon: Calendar },
    { path: "/roster", label: "Roster", icon: Users },
    { path: "/chat", label: "Chat", icon: MessageCircle },
  ],
  player: [
    { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { path: "/games", label: "Fixtures", icon: Calendar },
    { path: "/roster", label: "Statistics", icon: BarChart3 },
    { path: "/chat", label: "Chat", icon: MessageCircle },
  ],
};

// Bottom nav for mobile per mode
const MOBILE_NAV: Record<AppMode, { path: string; label: string; icon: typeof LayoutDashboard }[]> = {
  super_admin: NAV_SETS.super_admin.slice(0, 4),
  association: NAV_SETS.association.slice(0, 4),
  club: NAV_SETS.club.slice(0, 4),
  team: [
    { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { path: "/games", label: "Fixtures", icon: Calendar },
    { path: "/roster", label: "Roster", icon: Users },
    { path: "/chat", label: "Chat", icon: MessageCircle },
  ],
  player: [
    { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { path: "/games", label: "Fixtures", icon: Calendar },
    { path: "/roster", label: "Stats", icon: BarChart3 },
    { path: "/chat", label: "Chat", icon: MessageCircle },
  ],
};

// Profile icon destination per mode
const PROFILE_DEST: Record<AppMode, string> = {
  super_admin: "/admin/associations",
  association: "/admin/associations",
  club: "/admin",
  team: "/profile",
  player: "/profile",
};

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  created_at: string;
}

const AppLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { mode, setMode, availableModes, canSwitchMode, modeLabel } = useAppMode();
  const {
    associations,
    selectedAssociationId,
    selectedClubId,
    selectedTeamId,
    setSelectedAssociationId,
    setSelectedClubId,
    setSelectedTeamId,
    filteredClubs,
    filteredTeams,
    selectedAssociation,
  } = useTeamContext();

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isAssociationPopoverOpen, setIsAssociationPopoverOpen] = useState(false);
  const [isModeSwitcherOpen, setIsModeSwitcherOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  // Fetch notifications from DB
  useEffect(() => {
    if (!user) return;
    const fetchNotifications = async () => {
      const { data } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20);
      setNotifications(data || []);
    };
    fetchNotifications();
  }, [user]);

  const handleAssociationChange = (associationId: string) => {
    setSelectedAssociationId(associationId);
    setIsAssociationPopoverOpen(false);
  };

  const navItems = NAV_SETS[mode];
  const mobileNavItems = MOBILE_NAV[mode];
  const profileDest = PROFILE_DEST[mode];
  const unreadCount = notifications.filter((n) => !n.read).length;

  const isAdminMode = mode === "super_admin" || mode === "association" || mode === "club";

  // Show selectors based on mode
  const showAssociationSelector = mode === "super_admin";
  const showClubSelector = mode === "super_admin" || mode === "association";
  const showTeamSelector = mode === "super_admin" || mode === "association" || mode === "club" || mode === "team" || mode === "player";

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  const handleModeSwitch = (newMode: AppMode) => {
    setMode(newMode);
    setIsModeSwitcherOpen(false);
    // Navigate to mode's landing page
    const landing = newMode === "super_admin" || newMode === "association" || newMode === "club" ? "/admin" : "/dashboard";
    navigate(landing);
  };

  const renderSidebar = (isMobile: boolean) => (
    <>
      <nav className="flex-1 py-2">
        {navItems.map((item) => {
          const isActive =
            location.pathname === item.path ||
            (item.path === "/games" && location.pathname.startsWith("/games"));
          const Icon = item.icon;
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={isMobile ? () => setIsMobileMenuOpen(false) : undefined}
            >
              <div
                className={cn(
                  "flex items-center gap-3 px-4 py-3 mx-2 my-1 rounded-lg text-sm font-medium transition-all border-l-4",
                  isActive
                    ? "bg-secondary text-secondary-foreground border-secondary"
                    : "text-accent-foreground hover:bg-accent-foreground/10 border-transparent"
                )}
              >
                <Icon className="h-5 w-5" />
                {item.label}
              </div>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 space-y-2">
        {/* Mode Switcher */}
        {canSwitchMode && (
          <div className="relative">
            <button
              onClick={() => setIsModeSwitcherOpen(!isModeSwitcherOpen)}
              className="w-full flex items-center justify-between gap-2 px-4 py-3 rounded-lg text-sm font-medium text-accent-foreground hover:bg-accent-foreground/10 transition-all border border-border"
            >
              <span className="truncate">{modeLabel}</span>
              <ChevronDown className={cn("h-4 w-4 shrink-0 transition-transform", isModeSwitcherOpen && "rotate-180")} />
            </button>
            {isModeSwitcherOpen && (
              <div className="absolute bottom-full left-0 right-0 mb-1 bg-background border border-border rounded-lg shadow-lg p-1 z-50">
                <p className="text-xs font-medium text-muted-foreground px-3 py-2">Switch Mode</p>
                {availableModes.map((m) => (
                  <button
                    key={m}
                    onClick={() => handleModeSwitch(m)}
                    className={cn(
                      "w-full text-left px-3 py-2 rounded-md text-sm transition-colors",
                      m === mode
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-muted text-foreground"
                    )}
                  >
                    {MODE_LABELS[m]}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-accent-foreground hover:bg-accent-foreground/10 transition-all"
        >
          <LogOut className="h-5 w-5" />
          Logout
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top Header Bar */}
      <header className="sticky top-0 z-50 bg-primary border-b border-primary/20">
        <div className="flex h-14 items-center justify-between px-4">
          {/* Left: Association Logo & Selectors */}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden text-primary-foreground hover:bg-primary-foreground/10"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>

            {/* Association Logo with Popover - only interactive for super_admin */}
            {showAssociationSelector ? (
              <Popover open={isAssociationPopoverOpen} onOpenChange={setIsAssociationPopoverOpen}>
                <PopoverTrigger asChild>
                  <button className="w-10 h-10 rounded-lg overflow-hidden border-2 border-primary-foreground/20 hover:border-primary-foreground/50 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-foreground/50">
                    <Avatar className="w-full h-full rounded-none">
                      <AvatarImage
                        src={selectedAssociation?.logo_url || undefined}
                        alt={selectedAssociation?.name}
                        className="object-cover"
                      />
                      <AvatarFallback className="rounded-none bg-accent text-accent-foreground text-xs font-semibold">
                        {selectedAssociation?.abbreviation || selectedAssociation?.name?.substring(0, 2).toUpperCase() || "HA"}
                      </AvatarFallback>
                    </Avatar>
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-72 p-2 bg-background border-border" align="start">
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground px-2 py-1">Select Association</p>
                    {associations.map((assoc) => (
                      <button
                        key={assoc.id}
                        onClick={() => handleAssociationChange(assoc.id)}
                        className={cn(
                          "w-full flex items-center gap-3 px-2 py-2 rounded-lg text-left transition-colors",
                          selectedAssociationId === assoc.id
                            ? "bg-primary text-primary-foreground"
                            : "hover:bg-muted text-foreground"
                        )}
                      >
                        <Avatar className="w-8 h-8">
                          <AvatarImage src={assoc.logo_url || undefined} alt={assoc.name} className="object-cover" />
                          <AvatarFallback className="text-xs">
                            {assoc.abbreviation || assoc.name.substring(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm font-medium truncate">{assoc.name}</span>
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            ) : (
              // Static association logo for non-super_admin modes
              <div className="w-10 h-10 rounded-lg overflow-hidden border-2 border-primary-foreground/20">
                <Avatar className="w-full h-full rounded-none">
                  <AvatarImage
                    src={selectedAssociation?.logo_url || undefined}
                    alt={selectedAssociation?.name}
                    className="object-cover"
                  />
                  <AvatarFallback className="rounded-none bg-accent text-accent-foreground text-xs font-semibold">
                    {selectedAssociation?.abbreviation || selectedAssociation?.name?.substring(0, 2).toUpperCase() || "HA"}
                  </AvatarFallback>
                </Avatar>
              </div>
            )}

            {/* Club Selector - only for modes that need it */}
            {showClubSelector && filteredClubs.length > 0 && (
              <Select value={selectedClubId || undefined} onValueChange={setSelectedClubId}>
                <SelectTrigger className="w-[180px] lg:w-[200px] bg-accent text-accent-foreground border-0 font-medium">
                  <SelectValue placeholder="Select Club" />
                </SelectTrigger>
                <SelectContent className="bg-background border-border">
                  {filteredClubs.map((club) => (
                    <SelectItem key={club.id} value={club.id}>
                      {club.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Team Selector */}
            {showTeamSelector && filteredTeams.length > 0 && (
              <Select value={selectedTeamId || undefined} onValueChange={setSelectedTeamId}>
                <SelectTrigger className="w-[140px] lg:w-[180px] bg-accent text-accent-foreground border-0 font-medium">
                  <SelectValue placeholder="Select Team" />
                </SelectTrigger>
                <SelectContent className="bg-background border-border">
                  {filteredTeams.map((team) => (
                    <SelectItem key={team.id} value={team.id}>
                      {getTeamDisplayName(team)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Mode badge for admin modes */}
            {isAdminMode && (
              <Badge className="bg-accent text-accent-foreground text-xs hidden sm:flex ml-2">
                {modeLabel}
              </Badge>
            )}
          </div>

          {/* Right: Notifications & User */}
          <div className="flex items-center gap-3">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-primary-foreground hover:bg-primary-foreground/10 relative"
                >
                  <Bell className="h-5 w-5" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground text-xs flex items-center justify-center font-medium">
                      {unreadCount}
                    </span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-0 bg-background border-border" align="end">
                <div className="p-3 border-b border-border">
                  <h4 className="font-semibold text-foreground">Notifications</h4>
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <p className="p-4 text-sm text-muted-foreground">No notifications</p>
                  ) : (
                    notifications.map((notification) => (
                      <div
                        key={notification.id}
                        className={cn(
                          "p-3 border-b border-border last:border-0 hover:bg-muted/50 cursor-pointer",
                          !notification.read && "bg-muted/30"
                        )}
                      >
                        <div className="flex items-start gap-2">
                          <span className="text-lg">🔔</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground">{notification.title}</p>
                            <p className="text-sm text-muted-foreground">{notification.message}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {new Date(notification.created_at).toLocaleDateString("en-AU", {
                                day: "numeric",
                                month: "short",
                              })}
                            </p>
                          </div>
                          {!notification.read && (
                            <Badge className="bg-primary text-primary-foreground text-xs">New</Badge>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </PopoverContent>
            </Popover>
            
            <Link to={profileDest}>
              <div className="w-9 h-9 rounded-full bg-accent flex items-center justify-center hover:ring-2 hover:ring-primary-foreground/50 transition-all cursor-pointer">
                <User className="h-5 w-5 text-accent-foreground" />
              </div>
            </Link>
          </div>
        </div>
      </header>

      <div className="flex flex-1">
        {/* Desktop Sidebar */}
        <aside className="hidden lg:flex flex-col w-56 min-h-[calc(100vh-3.5rem)] bg-accent border-r border-border">
          {renderSidebar(false)}
        </aside>

        {/* Mobile Sidebar Overlay */}
        {isMobileMenuOpen && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <div
              className="absolute inset-0 bg-black/50"
              onClick={() => setIsMobileMenuOpen(false)}
            />
            <aside className="absolute left-0 top-14 bottom-0 w-64 bg-accent animate-slide-in-right flex flex-col">
              {renderSidebar(true)}
            </aside>
          </div>
        )}

        {/* Main Content */}
        <main className="flex-1 min-h-[calc(100vh-3.5rem)] p-4 lg:p-6 bg-muted/30">
          <Outlet />
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border lg:hidden">
        <div className="flex justify-around py-2">
          {mobileNavItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex flex-col items-center gap-1 px-3 py-1.5 rounded-lg transition-colors",
                  isActive ? "text-primary" : "text-muted-foreground"
                )}
              >
                <Icon className="h-5 w-5" />
                <span className="text-[10px] font-medium">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Spacer for mobile bottom nav */}
      <div className="h-16 lg:h-0" />
    </div>
  );
};

export default AppLayout;
