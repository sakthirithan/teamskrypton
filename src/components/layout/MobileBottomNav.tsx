import { useState, useEffect } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useGroupingNotifications } from '@/hooks/useGroupingNotifications';
import { useAuth } from '@/hooks/useAuth';
import { useAppMode } from '@/hooks/useAppMode';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Capacitor } from '@capacitor/core';
import {
  LayoutDashboard,
  Users,
  TrendingUp,
  Bell,
  MoreHorizontal,
  User,
  CheckSquare,
  FileText,
  MessageSquare,
  Bookmark,
  RefreshCw,
  LogOut,
  FolderKanban,
  Zap,
} from 'lucide-react';

export function MobileBottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { unreadCount } = useGroupingNotifications();
  const { profile, signOut } = useAuth();
  const { mode, setMode } = useAppMode();
  const [moreOpen, setMoreOpen] = useState(false);

  // Android Hardware Back Button listener
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let cleanup: (() => void) | null = null;

    import('@capacitor/app').then(({ App }) => {
      const listener = App.addListener('backButton', (data) => {
        if (location.pathname === '/grouping/home' || location.pathname === '/pbl/dashboard' || location.pathname === '/auth') {
          App.minimizeApp();
        } else {
          navigate(-1);
        }
      });
      cleanup = () => {
        listener.then((l) => l.remove());
      };
    });

    return () => {
      if (cleanup) cleanup();
    };
  }, [location.pathname, navigate]);

  const isActive = (path: string) => location.pathname === path;

  const handleSignOut = async () => {
    setMoreOpen(false);
    await signOut();
    navigate('/auth');
  };

  const isPbl = mode === 'pbl' || location.pathname.startsWith('/pbl');

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur border-t border-border md:hidden pb-[env(safe-area-inset-bottom)] shadow-lg">
        <div className="flex items-center justify-around h-14 px-1">
          {/* Home / Dashboard */}
          <NavLink
            to={isPbl ? '/pbl/dashboard' : '/grouping/home'}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center flex-1 py-1 text-[10px] font-medium transition-colors ${
                isActive ? 'text-primary font-bold' : 'text-muted-foreground hover:text-foreground'
              }`
            }
          >
            <LayoutDashboard className="w-5 h-5 mb-0.5" />
            <span>Home</span>
          </NavLink>

          {/* Team */}
          <NavLink
            to="/team"
            className={({ isActive }) =>
              `flex flex-col items-center justify-center flex-1 py-1 text-[10px] font-medium transition-colors ${
                isActive ? 'text-primary font-bold' : 'text-muted-foreground hover:text-foreground'
              }`
            }
          >
            <Users className="w-5 h-5 mb-0.5" />
            <span>Team</span>
          </NavLink>

          {/* Leaderboard */}
          <NavLink
            to="/grouping/leaderboard"
            className={({ isActive }) =>
              `flex flex-col items-center justify-center flex-1 py-1 text-[10px] font-medium transition-colors ${
                isActive ? 'text-primary font-bold' : 'text-muted-foreground hover:text-foreground'
              }`
            }
          >
            <TrendingUp className="w-5 h-5 mb-0.5" />
            <span>Leaderboard</span>
          </NavLink>

          {/* Notifications */}
          <NavLink
            to="/grouping/notifications"
            className={({ isActive }) =>
              `flex flex-col items-center justify-center flex-1 py-1 text-[10px] font-medium transition-colors relative ${
                isActive ? 'text-primary font-bold' : 'text-muted-foreground hover:text-foreground'
              }`
            }
          >
            <div className="relative">
              <Bell className="w-5 h-5 mb-0.5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-2 bg-destructive text-destructive-foreground text-[9px] font-extrabold px-1 min-w-[14px] h-3.5 flex items-center justify-center rounded-full">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </div>
            <span>Notifications</span>
          </NavLink>

          {/* More Menu Sheet */}
          <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
            <SheetTrigger asChild>
              <button className="flex flex-col items-center justify-center flex-1 py-1 text-[10px] font-medium text-muted-foreground hover:text-foreground">
                <MoreHorizontal className="w-5 h-5 mb-0.5" />
                <span>More</span>
              </button>
            </SheetTrigger>
            <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh] p-4 bg-card border-t border-border">
              <SheetHeader className="pb-3 border-b border-border">
                <SheetTitle className="flex items-center gap-2 text-sm font-semibold">
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                    {profile?.full_name?.charAt(0)?.toUpperCase() || 'U'}
                  </div>
                  <div className="flex flex-col text-left">
                    <span className="text-sm font-semibold">{profile?.full_name || 'User'}</span>
                    <span className="text-[10px] text-muted-foreground font-normal">{profile?.email}</span>
                  </div>
                </SheetTitle>
              </SheetHeader>

              <div className="grid grid-cols-2 gap-2 py-4 text-xs">
                {/* Navigation Actions */}
                <NavLink
                  to="/grouping/me"
                  onClick={() => setMoreOpen(false)}
                  className="flex items-center gap-2.5 p-2.5 rounded-lg border border-border/60 bg-muted/40 hover:bg-muted font-medium"
                >
                  <User className="w-4 h-4 text-primary" />
                  My Space
                </NavLink>

                <NavLink
                  to="/grouping/todos"
                  onClick={() => setMoreOpen(false)}
                  className="flex items-center gap-2.5 p-2.5 rounded-lg border border-border/60 bg-muted/40 hover:bg-muted font-medium"
                >
                  <CheckSquare className="w-4 h-4 text-emerald-500" />
                  To-Do List
                </NavLink>

                <NavLink
                  to="/grouping/skills"
                  onClick={() => setMoreOpen(false)}
                  className="flex items-center gap-2.5 p-2.5 rounded-lg border border-border/60 bg-muted/40 hover:bg-muted font-medium"
                >
                  <Zap className="w-4 h-4 text-amber-500" />
                  Team Skills
                </NavLink>

                <NavLink
                  to="/grouping/ps"
                  onClick={() => setMoreOpen(false)}
                  className="flex items-center gap-2.5 p-2.5 rounded-lg border border-border/60 bg-muted/40 hover:bg-muted font-medium"
                >
                  <FolderKanban className="w-4 h-4 text-indigo-500" />
                  PS Portal
                </NavLink>

                <NavLink
                  to="/grouping/notes"
                  onClick={() => setMoreOpen(false)}
                  className="flex items-center gap-2.5 p-2.5 rounded-lg border border-border/60 bg-muted/40 hover:bg-muted font-medium"
                >
                  <Bookmark className="w-4 h-4 text-purple-500" />
                  Notes
                </NavLink>

                <NavLink
                  to="/grouping/reflections"
                  onClick={() => setMoreOpen(false)}
                  className="flex items-center gap-2.5 p-2.5 rounded-lg border border-border/60 bg-muted/40 hover:bg-muted font-medium"
                >
                  <MessageSquare className="w-4 h-4 text-cyan-500" />
                  Reflections
                </NavLink>
              </div>

              <div className="pt-2 border-t border-border flex flex-col gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setMoreOpen(false);
                    setMode(isPbl ? 'grouping' : 'pbl');
                    navigate(isPbl ? '/grouping/home' : '/pbl/dashboard');
                  }}
                  className="w-full justify-start text-xs h-9"
                >
                  <RefreshCw className="w-3.5 h-3.5 mr-2" />
                  Switch to {isPbl ? 'Grouping Mode' : 'PBL Mode'}
                </Button>

                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleSignOut}
                  className="w-full justify-start text-xs h-9"
                >
                  <LogOut className="w-3.5 h-3.5 mr-2" />
                  Sign Out
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </nav>

      {/* Spacer padding for main container on mobile so content isn't obscured by fixed bottom nav */}
      <div className="h-14 md:hidden" />
    </>
  );
}
