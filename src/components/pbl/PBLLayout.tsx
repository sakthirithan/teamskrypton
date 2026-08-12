import { ReactNode, useRef } from 'react';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { PBLSidebar } from './PBLSidebar';
import { NotificationBell } from '@/components/grouping/NotificationBell';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { MobileBottomNav } from '@/components/layout/MobileBottomNav';
import { useAuth } from '@/hooks/useAuth';
import { useAppMode } from '@/hooks/useAppMode';
import { Header } from '@/components/layout/Header';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { User, LogOut, RefreshCw, Download, UserCog, Coins, Menu } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { ROLE_LABELS } from '@/lib/constants';
import { Badge } from '@/components/ui/badge';
import { GuestModeBadge } from '@/components/guest/GuestModeBadge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { UserListPanel } from '@/components/admin/UserListPanel';
import { PointsManagementPanel } from '@/components/admin/PointsManagementPanel';
import { ModeSelectionDialog } from '@/components/auth/ModeSelectionDialog';
import { AppMode } from '@/lib/groupingConstants';
import { useState } from 'react';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { PullToRefreshIndicator } from '@/components/layout/PullToRefreshIndicator';

interface PBLLayoutProps {
  children: ReactNode;
  title?: string;
}

export function PBLLayout({ children, title }: PBLLayoutProps) {
  const mainRef = useRef<HTMLElement>(null);
  const { pull, refreshing } = usePullToRefresh(mainRef);
  const { profile, role, signOut, isCaptainOrVice } = useAuth();
  const { clearMode, setMode } = useAppMode();
  const navigate = useNavigate();
  const { toast } = useToast();
  const isTL = role === 'team_captain';

  const [userListOpen, setUserListOpen] = useState(false);
  const [pointsOpen, setPointsOpen] = useState(false);
  const [showModeSwitch, setShowModeSwitch] = useState(false);

  const handleSignOut = async () => {
    clearMode();
    await signOut();
    navigate('/auth');
  };

  const handleModeSwitch = (mode: AppMode) => {
    setMode(mode);
    setShowModeSwitch(false);
    navigate(mode === 'grouping' ? '/grouping/home' : '/', { replace: true });
    toast({ title: 'Mode Switched', description: `Now in ${mode === 'grouping' ? 'Grouping' : 'PBL'} Mode` });
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <PBLSidebar />

        <div className="flex-1 flex flex-col min-w-0">
          {/* Top Bar with Safe Area Support */}
          <header className="min-h-[3.5rem] flex items-center justify-between border-b border-border bg-card/95 backdrop-blur px-3 sm:px-4 sticky top-0 z-40 pt-[env(safe-area-inset-top)]">
            <div className="flex items-center gap-3">
              <SidebarTrigger className="text-muted-foreground" />
              {title && (
                <h1 className="text-lg font-semibold hidden sm:block">{title}</h1>
              )}
            </div>

            <div className="flex items-center gap-2">
              <GuestModeBadge />

              <Badge variant="outline" className="hidden sm:flex items-center gap-1 text-xs">
                PBL Mode
              </Badge>

              <ThemeToggle />
              <NotificationBell />

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="rounded-full">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-semibold">
                      {profile?.full_name?.charAt(0)?.toUpperCase() || 'U'}
                    </div>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>
                    <div className="flex flex-col">
                      <span>{profile?.full_name || 'User'}</span>
                      <span className="text-xs font-normal text-muted-foreground">{profile?.email}</span>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />

                  {isCaptainOrVice && (
                    <DropdownMenuItem onClick={() => setUserListOpen(true)}>
                      <UserCog className="w-4 h-4 mr-2" />
                      User List
                    </DropdownMenuItem>
                  )}

                  {isTL && (
                    <DropdownMenuItem onClick={() => setPointsOpen(true)}>
                      <Coins className="w-4 h-4 mr-2" />
                      Manage Points
                    </DropdownMenuItem>
                  )}

                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setShowModeSwitch(true)}>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Switch Mode
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
                    <LogOut className="w-4 h-4 mr-2" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>

          {/* Main Content — Full Canvas for Notifications/Messenger */}
          <main ref={mainRef} className={location.pathname.includes('/notifications') ? "flex-1 flex flex-col min-h-0 min-w-0 overflow-hidden p-0" : "flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6 page-enter pb-20 md:pb-6"}>
            <PullToRefreshIndicator pull={pull} refreshing={refreshing} />
            {children}
          </main>
          <MobileBottomNav />
        </div>
      </div>

      {/* Dialogs */}
      {isCaptainOrVice && (
        <Dialog open={userListOpen} onOpenChange={setUserListOpen}>
          <DialogContent className="w-[95vw] max-w-4xl max-h-[90vh] overflow-hidden p-3 sm:p-6">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <UserCog className="w-5 h-5" />
                User Management
              </DialogTitle>
            </DialogHeader>
            <div className="overflow-y-auto max-h-[calc(90vh-80px)]">
              <UserListPanel onClose={() => setUserListOpen(false)} />
            </div>
          </DialogContent>
        </Dialog>
      )}

      {isTL && (
        <Dialog open={pointsOpen} onOpenChange={setPointsOpen}>
          <DialogContent className="w-[95vw] max-w-4xl max-h-[90vh] overflow-hidden p-3 sm:p-6">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Coins className="w-5 h-5" />
                Points Management
              </DialogTitle>
            </DialogHeader>
            <div className="overflow-y-auto max-h-[calc(90vh-80px)]">
              <PointsManagementPanel />
            </div>
          </DialogContent>
        </Dialog>
      )}

      <ModeSelectionDialog
        open={showModeSwitch}
        onSelectMode={handleModeSwitch}
        disableAutoSelect={true}
      />
    </SidebarProvider>
  );
}
