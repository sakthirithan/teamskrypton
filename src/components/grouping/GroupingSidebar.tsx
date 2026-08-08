import { useState, useEffect } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { NavLink } from '@/components/NavLink';
import { useAuth } from '@/hooks/useAuth';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  LayoutDashboard,
  BookOpen,
  ClipboardList,
  NotebookPen,
  MessageSquare,
  Calendar,
  Users,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Compass,
  Repeat,
  Target,
  TrendingUp,
  GraduationCap,
  Pin,
  PinOff,
  Send,
  ListChecks,
  Coins,
  Vote,
  Bell,
} from 'lucide-react';
import { useGroupingNotifications } from '@/hooks/useGroupingNotifications';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ROLE_LABELS } from '@/lib/constants';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { SendNotificationDialog } from './SendNotificationDialog';
import { usePblProjectLead } from './LeaderboardPanel';

const PINNED_KEY = 'grouping-sidebar-pinned';

function getPinnedSections(): string[] {
  try {
    const stored = localStorage.getItem(PINNED_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function setPinnedSections(sections: string[]) {
  localStorage.setItem(PINNED_KEY, JSON.stringify(sections));
}

interface NavItem {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
  tabParam?: string;
}

export function GroupingSidebar() {
  const { state, toggleSidebar } = useSidebar();
  const collapsed = state === 'collapsed';
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { profile, user, role, isLeadership, isCaptainOrVice } = useAuth();
  const { unreadCount } = useGroupingNotifications();
  const { data: isProjectLead } = usePblProjectLead(user?.id);
  const canManagePoints = isLeadership || isProjectLead;
  const isMobile = useIsMobile();

  const [pinned, setPinned] = useState<string[]>(getPinnedSections);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    myspace: true,
    psportal: true,
    workspace: true,
    tracking: true,
    management: true,
  });

  useEffect(() => {
    setPinnedSections(pinned);
  }, [pinned]);

  const togglePin = (section: string) => {
    setPinned((prev) =>
      prev.includes(section) ? prev.filter((s) => s !== section) : [...prev, section]
    );
  };

  const toggleSection = (section: string) => {
    setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const isActive = (url: string, tabParam?: string) => {
  const currentPath = location.pathname;
  const currentTab = searchParams.get('tab');

  // ✅ Case 1: My Space items (with tab)
  if (url.startsWith('/grouping/me')) {
    if (tabParam) {
      return currentPath === '/grouping/me' && currentTab === tabParam;
    }

    // Overview (no tab)
    return currentPath === '/grouping/me' && !currentTab;
  }

  // ✅ Case 2: Normal sidebar items
  return currentPath === url || currentPath.startsWith(url + '/');
  };

  // My Space sub-items (appear under My Space heading)
  const mySpaceItems: NavItem[] = [
    { title: 'Overview', url: '/grouping/me', icon: Compass },
    { title: 'Skill Developement', url: '/grouping/me?tab=skills', icon: Target, tabParam: 'skills' },
    ...(isLeadership
      ? [{ title: 'Reports', url: '/grouping/me?tab=feed-reports', icon: TrendingUp, tabParam: 'feed-reports' }]
      : []),
    { title: 'Study Board', url: '/grouping/me?tab=skill-dev', icon: GraduationCap, tabParam: 'skill-dev' },
  ];

  const psPortalItems: NavItem[] = [
    { title: 'PS Entries', url: '/grouping/me?tab=ps-entries', icon: ClipboardList, tabParam: 'ps-entries' },
    { title: 'PS Tracking', url: '/grouping/ps', icon: ClipboardList },
  ];

  const workspaceItems: NavItem[] = [
    ...(isLeadership
      ? [{ title: 'Team Skills', url: '/grouping/skills', icon: BookOpen }]
      : []),
    { title: 'Reflections', url: '/grouping/reflections', icon: NotebookPen },
    { title: 'Notes', url: '/grouping/notes', icon: MessageSquare },
  ];

  const trackingItems: NavItem[] = [
    { title: 'Habits', url: '/grouping/habits', icon: Repeat },
    { title: 'To-Do List', url: '/grouping/todos', icon: ListChecks },
  ];

  const managementItems: NavItem[] = [
    ...(isCaptainOrVice
      ? [{ title: 'Sessions', url: '/grouping/sessions', icon: Calendar }]
      : []),
  ];

  const renderNavItem = (item: NavItem) => {
  const active = isActive(item.url, item.tabParam);

  return (
    <SidebarMenuItem key={item.title}>
      <SidebarMenuButton asChild>
        <NavLink
          to={item.url}
          className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors
            ${
              active
                ? 'bg-primary text-white font-medium'
                : 'hover:bg-sidebar-accent'
            }
          `}
        >
          <item.icon className="h-4 w-4 shrink-0" />
          {!collapsed && <span>{item.title}</span>}
        </NavLink>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
  };

  const renderCollapsibleSection = (
    id: string,
    label: string,
    items: NavItem[],
    extra?: React.ReactNode
  ) => {
    if (items.length === 0 && !extra) return null;

    const isPinned = pinned.includes(id);
    const isOpen = openSections[id] || isPinned;
    const hasActiveItem = items.some((item) => isActive(item.url, item.tabParam));

    // On mobile with collapsed sections: show only heading, arrow expands
    // If pinned: always show items
    return (
      <SidebarGroup key={id}>
        {collapsed ? (
          <>
            <SidebarGroupLabel className="sr-only">{label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>{items.map(renderNavItem)}</SidebarMenu>
            </SidebarGroupContent>
          </>
        ) : (
          <Collapsible open={isOpen} onOpenChange={() => toggleSection(id)}>
            <div className="flex items-center justify-between px-2 group">
              <CollapsibleTrigger className="flex items-center gap-1 flex-1 py-1">
                <ChevronRight
                  className={`h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 ${
                    isOpen ? 'rotate-90' : ''
                  }`}
                />
                <span className={`text-xs font-semibold uppercase tracking-wider ${
                  hasActiveItem ? 'text-primary' : 'text-muted-foreground'
                }`}>
                  {label}
                </span>
              </CollapsibleTrigger>
              <Button
                variant="ghost"
                size="icon"
                className={`h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity ${
                  isPinned ? '!opacity-100' : ''
                }`}
                onClick={(e) => {
                  e.stopPropagation();
                  togglePin(id);
                }}
              >
                {isPinned ? (
                  <PinOff className="h-3 w-3 text-primary" />
                ) : (
                  <Pin className="h-3 w-3 text-muted-foreground" />
                )}
              </Button>
            </div>
            <CollapsibleContent>
              <SidebarGroupContent>
                <SidebarMenu>
                  {items.map(renderNavItem)}
                  {extra}
                </SidebarMenu>
              </SidebarGroupContent>
            </CollapsibleContent>
          </Collapsible>
        )}
      </SidebarGroup>
    );
  };

  const [isDashboardOpen, setIsDashboardOpen] = useState(
    location.pathname === '/grouping/sessions'
  );

  useEffect(() => {
    if (location.pathname === '/grouping/sessions') {
      setIsDashboardOpen(true);
    }
  }, [location.pathname]);

  return (
    <Sidebar collapsible={isMobile ? 'offcanvas' : 'icon'} className="border-r border-sidebar-border">
      <SidebarHeader className="p-3">
        {!collapsed ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center">
                  <img src="/favicon.ico" alt="Teams Krypton logo featuring TK initials on primary blue background" className="rounded-lg" />
                </div>
              <div>
                <h2 className="text-sm font-semibold">Teams Krypton</h2>
                <p className="text-[10px] text-muted-foreground">Grouping Mode</p>
              </div>
            </div>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={toggleSidebar}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="flex justify-center">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer"
              onClick={toggleSidebar}
            >
              <img src="/favicon.ico" alt="Teams Krypton logo featuring TK initials on primary blue background" className="rounded-lg " />
            </div>
          </div>
        )}
      </SidebarHeader>

      <SidebarContent>
        {/* Dashboard - collapsible with Sessions */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <div className="flex flex-col w-full">
                  <div className="flex items-center justify-between w-full">
                    <SidebarMenuButton asChild isActive={isActive('/grouping/home')}>
                      <NavLink
                        to="/grouping/home"
                        className="flex-1 flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors hover:bg-sidebar-accent"
                        activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                      >
                        <LayoutDashboard className="h-4 w-4 shrink-0" />
                        {!collapsed && <span>Dashboard</span>}
                      </NavLink>
                    </SidebarMenuButton>
                    {isCaptainOrVice && !collapsed && (
                      <button
                        type="button"
                        onClick={() => setIsDashboardOpen(!isDashboardOpen)}
                        className="p-1 hover:bg-sidebar-accent rounded transition-colors mr-1"
                        title="Toggle Sessions"
                      >
                        <ChevronRight className={`h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 ${isDashboardOpen ? 'rotate-90' : ''}`} />
                      </button>
                    )}
                  </div>

                  {isCaptainOrVice && (isDashboardOpen || isActive('/grouping/sessions')) && !collapsed && (
                    <div className="pl-6 pt-1 space-y-1">
                      <SidebarMenuButton asChild isActive={isActive('/grouping/sessions')}>
                        <NavLink
                          to="/grouping/sessions"
                          className="flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-colors hover:bg-sidebar-accent"
                          activeClassName="bg-primary/10 text-primary font-medium"
                        >
                          <Calendar className="h-3.5 w-3.5 shrink-0" />
                          <span>Sessions</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </div>
                  )}
                </div>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isActive('/team')}>
                  <NavLink
                    to="/team"
                    className="flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors hover:bg-sidebar-accent"
                    activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                  >
                    <Users className="h-4 w-4 shrink-0" />
                    {!collapsed && <span>Team</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isActive('/grouping/leaderboard')}>
                  <NavLink
                    to="/grouping/leaderboard"
                    className="flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors hover:bg-sidebar-accent"
                    activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                  >
                    <TrendingUp className="h-4 w-4 shrink-0" />
                    {!collapsed && <span>Leaderboard</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isActive('/grouping/notifications')}>
                  <NavLink
                    to="/grouping/notifications"
                    className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-md text-sm transition-colors hover:bg-sidebar-accent"
                    activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Bell className="h-4 w-4 shrink-0 text-primary" />
                      {!collapsed && <span>Notifications</span>}
                    </div>
                    {unreadCount > 0 && (
                      <Badge
                        variant="destructive"
                        className="text-[10px] px-1.5 py-0 h-4 rounded-full font-extrabold shadow-sm"
                      >
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </Badge>
                    )}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* My Space - Collapsible with sub-items */}
        {renderCollapsibleSection('myspace', 'My Space', mySpaceItems)}

        {/* PS Portal */}
        {renderCollapsibleSection('psportal', 'PS Portal', psPortalItems)}

        {/* Tracking */}
        {renderCollapsibleSection('tracking', 'Tracking', trackingItems)}

        {/* Workspace */}
        {renderCollapsibleSection('workspace', 'Workspace', workspaceItems)}
      </SidebarContent>

      <SidebarFooter className="p-3">
        {!collapsed && profile && (
          <div className="flex items-center gap-2 p-2 rounded-lg bg-sidebar-accent/50">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-semibold">
              {profile.full_name?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{profile.full_name}</p>
              {role && (
                <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">
                  {ROLE_LABELS[role]}
                </Badge>
              )}
            </div>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
