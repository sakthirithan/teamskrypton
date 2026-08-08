import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useAppMode } from '@/hooks/useAppMode';
import { ROLE_LABELS, KryptonRole } from '@/lib/constants';
import { LogOut, User, Users, Home, LayoutDashboard, Menu, X, Download, UserCog, Target, RefreshCw, Coins } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { UserListPanel } from '@/components/admin/UserListPanel';
import { PointsManagementPanel } from '@/components/admin/PointsManagementPanel';
import { ModeSelectionDialog } from '@/components/auth/ModeSelectionDialog';
import { Badge } from '@/components/ui/badge';
import { AppMode } from '@/lib/groupingConstants';
import { GuestModeBadge } from '@/components/guest/GuestModeBadge';
import { usePblProjectLead } from '@/components/grouping/LeaderboardPanel';
import { ThemeToggle } from '@/components/theme/ThemeToggle';

function getRoleBadgeClass(role: KryptonRole | null): string {
  switch (role) {
    case 'team_captain':
      return 'role-badge role-captain';
    case 'vice_captain':
      return 'role-badge role-vice-captain';
    case 'strategist':
      return 'role-badge role-strategist';
    case 'team_manager':
      return 'role-badge role-manager';
    case 'team_member':
      return 'role-badge role-member';
    default:
      return 'role-badge bg-muted text-muted-foreground';
  }
}

export function Header() {
  const { user, profile, role, signOut, isCaptainOrVice, isLeadership } = useAuth();
  const { isGroupingMode, clearMode, setMode } = useAppMode();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userListOpen, setUserListOpen] = useState(false);
  const [pointsOpen, setPointsOpen] = useState(false);
  const [showModeSwitch, setShowModeSwitch] = useState(false);
  const [showModeDialog, setShowModeDialog] = useState(false);
  
  const { data: isProjectLead } = usePblProjectLead(user?.id);
  const canManagePoints = isLeadership || isProjectLead;

  // Mode-aware navigation links
  const navLinks = isGroupingMode
    ? [
        { path: '/grouping/home', label: 'Home', icon: Home },
        { path: '/team', label: 'Team', icon: Users },
        { path: '/grouping/me', label: 'My Space', icon: Target },
      ]
    : [
        { path: '/pbl/dashboard', label: 'Dashboard', icon: Home },
        { path: '/pbl/projects', label: 'Projects', icon: LayoutDashboard },
        { path: '/pbl/analytics', label: 'Analytics', icon: Target },
        { path: '/team', label: 'Team', icon: Users },
      ];

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
  };

  const handleSignOut = async () => {
    clearMode(); // Reset mode selection on logout
    await signOut();
    navigate('/auth');
  };

  // Handle mode switch from profile menu
  const handleModeSwitch = (mode: AppMode) => {
    setMode(mode);
    setShowModeSwitch(false);
    // Navigate to appropriate home based on selected mode
    navigate(mode === 'grouping' ? '/grouping/home' : '/', { replace: true });
    toast({ title: 'Mode Switched', description: `Now in ${mode === 'grouping' ? 'Grouping' : 'PBL'} Mode` });
  };

  const handleInstallAPK = () => {
    // Trigger PWA install prompt or show instructions
    const installEvent = (window as any).deferredPrompt;
    if (installEvent) {
      installEvent.prompt();
      installEvent.userChoice.then((choiceResult: { outcome: string }) => {
        if (choiceResult.outcome === 'accepted') {
          toast({
            title: "Installing App",
            description: "Teams Krypton is being installed on your device.",
          });
        }
        (window as any).deferredPrompt = null;
      });
    } else {
      toast({
        title: "Install Teams Krypton",
        description: "Use your browser's menu to 'Add to Home Screen' or 'Install App'.",
      });
    }
  };

  const isActive = (path: string) => location.pathname === path;

  // // Store install prompt for later use
  // useEffect(() => {
  //   const handleBeforeInstallPrompt = (e: Event) => {
  //     e.preventDefault();
  //     (window as any).deferredPrompt = e;
  //   };
  //   window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  //   return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  // }, []);

  return (
    <header className="krypton-gradient text-primary-foreground sticky top-0 z-50 shadow-lg safe-area-top">
      <div className="container mx-auto px-3 sm:px-6 py-2 sm:py-4">
        <div className="flex items-center justify-between">
          {/* Logo and Title */}
          <div className="flex items-center gap-2 sm:gap-6">
            <div 
              className="flex flex-col cursor-pointer group"
              onClick={() => navigate('/')}
            >
              <h1 className="text-lg sm:text-2xl font-display font-bold tracking-tight transition-all duration-200 group-hover:tracking-wide">
                Teams Krypton
              </h1>
              <p className="text-xs sm:text-sm opacity-80 transition-opacity duration-200 group-hover:opacity-100 hidden sm:block">
                Where Work Becomes Visible
              </p>
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-1 ml-8">
              {navLinks.map((link, index) => (
                <Button
                  key={link.path}
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate(link.path)}
                  className={`text-primary-foreground hover:bg-primary-foreground/10 transition-all duration-200 ${
                    isActive(link.path) 
                      ? 'bg-primary-foreground/20 shadow-sm' 
                      : 'hover:translate-y-[-1px]'
                  }`}
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <link.icon className="w-4 h-4 mr-1.5" />
                  {link.label}
                </Button>
              ))}
            </nav>
          </div>

          {/* Date and Time - Hidden on mobile */}
          <div className="hidden lg:flex flex-col items-center px-3 py-2 rounded-lg bg-primary-foreground/5 backdrop-blur-sm">
            <span className="text-sm opacity-80">{formatDate(currentTime)}</span>
            <span className="text-xl font-mono font-semibold tabular-nums">{formatTime(currentTime)}</span>
          </div>

          {/* User Info & Mobile Menu */}
          <div className="flex items-center gap-2 sm:gap-4">
            {/* Guest Mode Badge */}
            <GuestModeBadge />
            
            {/* Mode Indicator Badge (read-only, shows current mode) */}
            <Badge 
              variant="outline" 
              className="hidden sm:flex items-center gap-1.5 bg-primary-foreground/10 text-primary-foreground border-primary-foreground/30"
            >
              {isGroupingMode ? (
                <>
                  <Target className="w-3 h-3" />
                  Grouping
                </>
              ) : (
                <>
                  <LayoutDashboard className="w-3 h-3" />
                  PBL
                </>
              )}
            </Badge>
            
            <ThemeToggle className="text-primary-foreground hover:bg-primary-foreground/10" />
            
            {/* User Profile Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <div className="flex items-center gap-2 sm:gap-3 cursor-pointer hover:opacity-90 transition-all duration-200 p-1.5 sm:p-2 rounded-lg hover:bg-primary-foreground/10 touch-target">
                  <div className="hidden sm:flex flex-col items-end">
                    <span className="font-medium text-sm">{profile?.full_name || 'User'}</span>
                    {role && (
                      <span className={`${getRoleBadgeClass(role)} text-[10px] sm:text-xs`}>
                        {ROLE_LABELS[role]}
                      </span>
                    )}
                  </div>
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-primary-foreground/20 flex items-center justify-center ring-2 ring-primary-foreground/30 transition-all duration-200 hover:ring-primary-foreground/50">
                    <User className="w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex flex-col">
                    <span>{profile?.full_name || 'User'}</span>
                    <span className="text-xs font-normal text-muted-foreground">
                      {profile?.email}
                    </span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                
                <DropdownMenuItem onClick={() => navigate('/my-space')}>
                  <LayoutDashboard className="w-4 h-4 mr-2" />
                  My Space
                </DropdownMenuItem>
                
                {/* User List - Only for TL & VC */}
                {isCaptainOrVice && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setUserListOpen(true)}>
                      <UserCog className="w-4 h-4 mr-2" />
                      User List
                    </DropdownMenuItem>
                  </>
                )}
                
                {/* Points Management - Only for Leaders */}
                {canManagePoints && (
                  <DropdownMenuItem onClick={() => setPointsOpen(true)}>
                    <Coins className="w-4 h-4 mr-2" />
                    Manage Points
                  </DropdownMenuItem>
                )}
                
                <DropdownMenuSeparator />
                
                {/* Switch Mode - Available to all */}
                <DropdownMenuItem onClick={() => setShowModeSwitch(true)}>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Switch Mode
                </DropdownMenuItem>
                
                {/* Install APK - Available to all */}
                <DropdownMenuItem onClick={handleInstallAPK}>
                  <Download className="w-4 h-4 mr-2" />
                  Install App
                </DropdownMenuItem>
                
                <DropdownMenuSeparator />
                
                <DropdownMenuItem onClick={handleSignOut} className="text-red-600">
                  <LogOut className="w-4 h-4 mr-2" />
                  Sign Out
                </DropdownMenuItem>
            </DropdownMenuContent>
            </DropdownMenu>

            {/* Mobile Menu Toggle */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden text-primary-foreground hover:bg-primary-foreground/10 touch-target"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
          </div>
        </div>

        {/* Mobile Navigation - Slide-in drawer style */}
        {mobileMenuOpen && (
          <nav className="md:hidden mt-3 pt-3 border-t border-primary-foreground/20 flex flex-col gap-1 animate-fade-in safe-area-bottom">
            {/* User info for mobile */}
            <div className="flex items-center gap-3 p-3 rounded-lg bg-primary-foreground/10 mb-2">
              <div className="w-10 h-10 rounded-full bg-primary-foreground/20 flex items-center justify-center">
                <User className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{profile?.full_name || 'User'}</p>
                {role && (
                  <span className={`${getRoleBadgeClass(role)} text-[10px]`}>
                    {ROLE_LABELS[role]}
                  </span>
                )}
              </div>
            </div>
            
            {navLinks.map((link, index) => (
              <Button
                key={link.path}
                variant="ghost"
                onClick={() => {
                  navigate(link.path);
                  setMobileMenuOpen(false);
                }}
                className={`justify-start text-primary-foreground hover:bg-primary-foreground/10 h-12 touch-target ${
                  isActive(link.path) ? 'bg-primary-foreground/20' : ''
                }`}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <link.icon className="w-5 h-5 mr-3" />
                {link.label}
              </Button>
            ))}
            
            {/* User List for TL/VC on mobile */}
            {isCaptainOrVice && (
              <Button
                variant="ghost"
                onClick={() => {
                  setUserListOpen(true);
                  setMobileMenuOpen(false);
                }}
                className="justify-start text-primary-foreground hover:bg-primary-foreground/10 h-12 touch-target"
              >
                <UserCog className="w-5 h-5 mr-3" />
                User List
              </Button>
            )}
            
            {/* Points Management for Leaders on mobile */}
            {canManagePoints && (
              <Button
                variant="ghost"
                onClick={() => {
                  setPointsOpen(true);
                  setMobileMenuOpen(false);
                }}
                className="justify-start text-primary-foreground hover:bg-primary-foreground/10 h-12 touch-target"
              >
                <Coins className="w-5 h-5 mr-3" />
                Manage Points
              </Button>
            )}
            
            <div className="border-t border-primary-foreground/20 pt-2 mt-2 space-y-1">
              {/* Switch Mode for mobile */}
              <Button
                variant="ghost"
                onClick={() => {
                  setShowModeSwitch(true);
                  setMobileMenuOpen(false);
                }}
                className="justify-start text-primary-foreground hover:bg-primary-foreground/10 w-full h-12 touch-target"
              >
                <RefreshCw className="w-5 h-5 mr-3" />
                Switch Mode
              </Button>
              
              {/* Install App for mobile */}
              <Button
                variant="ghost"
                onClick={() => {
                  handleInstallAPK();
                  setMobileMenuOpen(false);
                }}
                className="justify-start text-primary-foreground hover:bg-primary-foreground/10 w-full h-12 touch-target"
              >
                <Download className="w-5 h-5 mr-3" />
                Install App
              </Button>
              
              <Button
                variant="ghost"
                onClick={handleSignOut}
                className="justify-start text-red-300 hover:bg-red-500/20 w-full h-12 touch-target"
              >
                <LogOut className="w-5 h-5 mr-3" />
                Sign Out
              </Button>
            </div>
          </nav>
        )}
      </div>

      {/* User List Dialog - TL/VC Only - Mobile optimized */}
      {isCaptainOrVice && (
        <Dialog open={userListOpen} onOpenChange={setUserListOpen}>
          <DialogContent className="w-[95vw] max-w-4xl max-h-[90vh] overflow-hidden p-3 sm:p-6">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
                <UserCog className="w-4 h-4 sm:w-5 sm:h-5" />
                User Management
              </DialogTitle>
            </DialogHeader>
            <div className="overflow-y-auto max-h-[calc(90vh-80px)] scrollbar-hide">
              <UserListPanel onClose={() => setUserListOpen(false)} />
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Points Management Dialog - Leaders Only */}
      {canManagePoints && (
        <Dialog open={pointsOpen} onOpenChange={setPointsOpen}>
          <DialogContent className="w-[95vw] max-w-4xl max-h-[90vh] overflow-hidden p-3 sm:p-6">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
                <Coins className="w-4 h-4 sm:w-5 sm:h-5" />
                Points Management
              </DialogTitle>
            </DialogHeader>
            <div className="overflow-y-auto max-h-[calc(90vh-80px)] scrollbar-hide">
              <PointsManagementPanel />
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Mode Switch Dialog */}
      <ModeSelectionDialog
        open={showModeSwitch}
        onSelectMode={handleModeSwitch}
        disableAutoSelect={true}
      />
    </header>
  );
}
