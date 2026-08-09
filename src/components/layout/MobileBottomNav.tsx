import { useState, useEffect, useMemo } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useGroupingNotifications } from '@/hooks/useGroupingNotifications';
import { useAuth } from '@/hooks/useAuth';
import { useAppMode } from '@/hooks/useAppMode';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Capacitor } from '@capacitor/core';
import {
  getUserNavPreferences,
  CustomizeNavDialog,
} from '@/components/layout/CustomizeNavDialog';
import {
  getAvailableNavCategories,
  getAllAvailableNavItems,
  ICON_COMPONENT_MAP,
} from '@/lib/navConfig';
import { usePblProjectLead } from '@/components/grouping/LeaderboardPanel';
import {
  LayoutDashboard,
  MoreHorizontal,
  RefreshCw,
  LogOut,
  Sliders,
} from 'lucide-react';

export function MobileBottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { unreadCount } = useGroupingNotifications();
  const { user, profile, isLeadership, isCaptainOrVice, signOut } = useAuth();
  const { mode, setMode } = useAppMode();
  const { data: isProjectLead } = usePblProjectLead(user?.id);
  const canManagePoints = isLeadership || !!isProjectLead;

  const [moreOpen, setMoreOpen] = useState(false);
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [navPrefIds, setNavPrefIds] = useState<string[]>([]);

  const permissions = useMemo(
    () => ({ isLeadership, isCaptainOrVice, canManagePoints }),
    [isLeadership, isCaptainOrVice, canManagePoints]
  );

  const availableCategories = useMemo(
    () => getAvailableNavCategories(permissions),
    [permissions]
  );

  const allAvailableItems = useMemo(
    () => getAllAvailableNavItems(permissions),
    [permissions]
  );

  // Load preferences
  useEffect(() => {
    setNavPrefIds(getUserNavPreferences(user?.id));
  }, [user?.id]);

  // Android Hardware Back Button listener
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let cleanup: (() => void) | null = null;

    import('@capacitor/app').then(({ App }) => {
      const listener = App.addListener('backButton', () => {
        if (
          location.pathname === '/grouping/home' ||
          location.pathname === '/pbl/dashboard' ||
          location.pathname === '/auth'
        ) {
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

  const handleSignOut = async () => {
    setMoreOpen(false);
    await signOut();
    navigate('/auth');
  };

  const isPbl = mode === 'pbl' || location.pathname.startsWith('/pbl');

  const activeNavItems = useMemo(() => {
    return navPrefIds
      .map((id) => allAvailableItems.find((opt) => opt.id === id))
      .filter(Boolean) as typeof allAvailableItems;
  }, [navPrefIds, allAvailableItems]);

  const [chatActive, setChatActive] = useState(false);

  useEffect(() => {
    const check = () => setChatActive(document.body.dataset.activeChat === 'true');
    check();
    window.addEventListener('chat-active-change', check);
    return () => window.removeEventListener('chat-active-change', check);
  }, [location.pathname]);

  if (chatActive) return null;

  return (
    <>
      {/* Floating iPhone-Style Bottom Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden pb-[env(safe-area-inset-bottom)] pointer-events-none">
        <div className="w-[calc(100%-1.25rem)] max-w-lg mx-auto mb-2 pointer-events-auto bg-card/90 backdrop-blur-xl border border-border/80 rounded-2xl shadow-xl px-1.5 py-1 flex items-center justify-around">
          {activeNavItems.map((item) => {
            const IconComponent = ICON_COMPONENT_MAP[item.iconName] || LayoutDashboard;
            const targetPath = item.id === 'dashboard' && isPbl ? '/pbl/dashboard' : item.path;
            const isNotif = item.id === 'notifications';

            return (
              <NavLink
                key={item.id}
                to={targetPath}
                className={({ isActive }) =>
                  `flex flex-col items-center justify-center flex-1 py-1.5 px-1 rounded-xl text-[10px] font-medium transition-all ${
                    isActive
                      ? 'text-primary font-bold bg-primary/10'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
                  }`
                }
              >
                <div className="relative">
                  <IconComponent className="w-5 h-5 mb-0.5 shrink-0" />
                  {isNotif && unreadCount > 0 && (
                    <span className="absolute -top-1 -right-2 bg-destructive text-destructive-foreground text-[9px] font-extrabold px-1 min-w-[14px] h-3.5 flex items-center justify-center rounded-full border border-background">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </div>
                <span className="truncate max-w-[60px]">{item.label}</span>
              </NavLink>
            );
          })}

          {/* More Menu Trigger */}
          <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
            <SheetTrigger asChild>
              <button className="flex flex-col items-center justify-center flex-1 py-1.5 px-1 rounded-xl text-[10px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-all">
                <MoreHorizontal className="w-5 h-5 mb-0.5 shrink-0" />
                <span>More</span>
              </button>
            </SheetTrigger>
            <SheetContent side="bottom" className="rounded-t-3xl max-h-[85vh] p-4 bg-card border-t border-border overflow-y-auto">
              <SheetHeader className="pb-3 border-b border-border">
                <SheetTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-left">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                      {profile?.full_name?.charAt(0)?.toUpperCase() || 'U'}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold">{profile?.full_name || 'User'}</span>
                      <span className="text-[10px] text-muted-foreground font-normal">{profile?.email}</span>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setMoreOpen(false);
                      setCustomizeOpen(true);
                    }}
                    className="text-xs h-8 px-2.5"
                  >
                    <Sliders className="w-3.5 h-3.5 mr-1 text-primary" />
                    Customize Nav
                  </Button>
                </SheetTitle>
              </SheetHeader>

              {/* Categorized More Navigation Sheet */}
              <div className="space-y-4 py-4">
                {availableCategories.map((cat) => (
                  <div key={cat.id} className="space-y-1.5">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground px-1">
                      {cat.category}
                    </span>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {cat.items.map((item) => {
                        const IconComp = ICON_COMPONENT_MAP[item.iconName] || LayoutDashboard;
                        return (
                          <NavLink
                            key={item.id}
                            to={item.path}
                            onClick={() => setMoreOpen(false)}
                            className="flex items-center gap-2.5 p-2.5 rounded-xl border border-border/60 bg-muted/30 hover:bg-muted font-medium transition-colors"
                          >
                            <IconComp className="w-4 h-4 text-primary shrink-0" />
                            <span className="truncate">{item.label}</span>
                          </NavLink>
                        );
                      })}
                    </div>
                  </div>
                ))}
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

      {/* Customize Quick Actions Modal */}
      <CustomizeNavDialog
        open={customizeOpen}
        onOpenChange={setCustomizeOpen}
        onSave={(updatedIds) => setNavPrefIds(updatedIds)}
      />

      {/* Spacer padding for main container on mobile so content isn't obscured by floating bottom nav */}
      <div className="h-16 md:hidden" />
    </>
  );
}
