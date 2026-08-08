import { useLocation } from 'react-router-dom';
import { NavLink } from '@/components/NavLink';
import { useAuth } from '@/hooks/useAuth';
import {
  LayoutDashboard,
  FolderKanban,
  Users,
  BarChart3,
  ChevronLeft,
  FileText,
  Bell,
  ListChecks,
  User,
  Vote,
} from 'lucide-react';
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
import { KryptonLogo } from '@/components/common/KryptonLogo';
import { useGroupingNotifications } from '@/hooks/useGroupingNotifications';

const mainNavItems = [
  { title: 'Dashboard', url: '/pbl/dashboard', icon: LayoutDashboard },
  { title: 'Team', url: '/team', icon: Users },
  { title: 'My Space', url: '/pbl/my-space', icon: User },
  { title: 'Projects', url: '/pbl/projects', icon: FolderKanban },
  { title: 'Documentation', url: '/pbl/docs', icon: FileText },
  { title: 'To-Do List', url: '/pbl/todos', icon: ListChecks },
  { title: 'Notifications', url: '/grouping/notifications', icon: Bell },
  { title: 'Analytics', url: '/pbl/analytics', icon: BarChart3 },
];

export function PBLSidebar() {
  const { state, toggleSidebar } = useSidebar();
  const collapsed = state === 'collapsed';
  const location = useLocation();
  const { profile, role } = useAuth();
  const { unreadCount } = useGroupingNotifications();

  const isActive = (path: string) => {
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="p-3">
        {!collapsed ? (
          <div className="flex items-center justify-between">
            <KryptonLogo size={32} showText subtext="Project Mode" />
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={toggleSidebar}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="flex justify-center">
            <div className="cursor-pointer" onClick={toggleSidebar}>
              <KryptonLogo size={32} showText={false} />
            </div>
          </div>
        )}
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className={collapsed ? 'sr-only' : ''}>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNavItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)}>
                    <NavLink
                      to={item.url}
                      end={item.url === '/'}
                      className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-md text-sm transition-colors hover:bg-sidebar-accent"
                      activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <item.icon className="h-4 w-4 shrink-0" />
                        {!collapsed && <span>{item.title}</span>}
                      </div>
                      {item.title === 'Notifications' && unreadCount > 0 && (
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
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
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
