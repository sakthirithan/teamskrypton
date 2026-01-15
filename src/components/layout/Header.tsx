import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { ROLE_LABELS, KryptonRole } from '@/lib/constants';
import { LogOut, User, Users, Home, LayoutDashboard, Menu, X, Download, UserCog } from 'lucide-react';
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
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { UserListPanel } from '@/components/admin/UserListPanel';

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
  const { user, profile, role, signOut, isCaptainOrVice } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userListOpen, setUserListOpen] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  const handleSignOut = async () => {
    setMobileMenuOpen(false);
    await signOut();
    navigate('/auth');
  };

  const handleInstallAPK = () => {
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

  const navLinks = [
    { path: '/', label: 'Home', icon: Home },
    { path: '/team', label: 'Team', icon: Users },
    { path: '/my-space', label: 'My Space', icon: LayoutDashboard },
  ];

  const isActive = (path: string) => location.pathname === path;

  // Store install prompt for later use
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      (window as any).deferredPrompt = e;
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleNavigation = (path: string) => {
    navigate(path);
    setMobileMenuOpen(false);
  };

  return (
    <header className="krypton-gradient text-primary-foreground sticky top-0 z-50 shadow-lg">
      <div className="container mx-auto px-3 sm:px-6 py-2 sm:py-4">
        <div className="flex items-center justify-between">
          {/* Logo - Compact on mobile */}
          <div className="flex items-center gap-2 sm:gap-6">
            <div 
              className="flex flex-col cursor-pointer group"
              onClick={() => navigate('/')}
            >
              <h1 className="text-lg sm:text-2xl font-display font-bold tracking-tight">
                Krypton
              </h1>
              <p className="text-[10px] sm:text-sm opacity-80 hidden sm:block">
                Where Work Becomes Visible
              </p>
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-1 ml-4 lg:ml-8">
              {navLinks.map((link) => (
                <Button
                  key={link.path}
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate(link.path)}
                  className={`text-primary-foreground hover:bg-primary-foreground/10 min-h-[44px] ${
                    isActive(link.path) 
                      ? 'bg-primary-foreground/20 shadow-sm' 
                      : ''
                  }`}
                >
                  <link.icon className="w-4 h-4 mr-1.5" />
                  {link.label}
                </Button>
              ))}
            </nav>
          </div>

          {/* Date/Time - Hidden on mobile, compact on tablet */}
          <div className="hidden md:flex flex-col items-center px-3 py-1 lg:px-4 lg:py-2 rounded-lg bg-primary-foreground/5">
            <span className="text-xs lg:text-sm opacity-80">{formatDate(currentTime)}</span>
            <span className="text-sm lg:text-xl font-mono font-semibold tabular-nums">{formatTime(currentTime)}</span>
          </div>

          {/* Right Side Controls */}
          <div className="flex items-center gap-2">
            {/* User Profile - Desktop */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <div className="hidden sm:flex items-center gap-2 cursor-pointer hover:opacity-90 p-2 rounded-lg hover:bg-primary-foreground/10 min-h-[44px]">
                  <div className="flex flex-col items-end">
                    <span className="font-medium text-sm">{profile?.full_name || 'User'}</span>
                    {role && (
                      <span className={`${getRoleBadgeClass(role)} text-[10px]`}>
                        {ROLE_LABELS[role]}
                      </span>
                    )}
                  </div>
                  <div className="w-9 h-9 rounded-full bg-primary-foreground/20 flex items-center justify-center ring-2 ring-primary-foreground/30">
                    <User className="w-4 h-4" />
                  </div>
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 bg-background z-50">
                <DropdownMenuLabel>
                  <div className="flex flex-col">
                    <span>{profile?.full_name || 'User'}</span>
                    <span className="text-xs font-normal text-muted-foreground">
                      {profile?.email}
                    </span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                
                <DropdownMenuItem onClick={() => navigate('/my-space')} className="min-h-[44px]">
                  <LayoutDashboard className="w-4 h-4 mr-2" />
                  My Space
                </DropdownMenuItem>
                
                {isCaptainOrVice && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setUserListOpen(true)} className="min-h-[44px]">
                      <UserCog className="w-4 h-4 mr-2" />
                      User List
                    </DropdownMenuItem>
                  </>
                )}
                
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleInstallAPK} className="min-h-[44px]">
                  <Download className="w-4 h-4 mr-2" />
                  Install App
                </DropdownMenuItem>
                
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="text-red-600 min-h-[44px]">
                  <LogOut className="w-4 h-4 mr-2" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Mobile Menu - Sheet Drawer */}
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="sm:hidden text-primary-foreground hover:bg-primary-foreground/10 min-w-[44px] min-h-[44px]"
                >
                  <Menu className="w-6 h-6" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[280px] sm:w-[320px] bg-background z-[60]">
                <SheetHeader className="text-left pb-4 border-b">
                  <SheetTitle className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                      <User className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex flex-col">
                      <span className="font-medium">{profile?.full_name || 'User'}</span>
                      {role && (
                        <span className={`${getRoleBadgeClass(role)} text-xs`}>
                          {ROLE_LABELS[role]}
                        </span>
                      )}
                    </div>
                  </SheetTitle>
                </SheetHeader>

                {/* Mobile Navigation Links */}
                <nav className="flex flex-col gap-1 py-4">
                  {navLinks.map((link) => (
                    <Button
                      key={link.path}
                      variant={isActive(link.path) ? "secondary" : "ghost"}
                      onClick={() => handleNavigation(link.path)}
                      className={`justify-start min-h-[48px] text-base ${
                        isActive(link.path) ? 'bg-primary/10 text-primary' : ''
                      }`}
                    >
                      <link.icon className="w-5 h-5 mr-3" />
                      {link.label}
                    </Button>
                  ))}
                </nav>

                {/* Leadership Options */}
                {isCaptainOrVice && (
                  <div className="border-t pt-4 space-y-1">
                    <p className="text-xs text-muted-foreground px-3 mb-2">Leadership</p>
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setMobileMenuOpen(false);
                        setUserListOpen(true);
                      }}
                      className="w-full justify-start min-h-[48px] text-base"
                    >
                      <UserCog className="w-5 h-5 mr-3" />
                      User Management
                    </Button>
                  </div>
                )}

                {/* Utility Actions */}
                <div className="border-t pt-4 mt-4 space-y-1">
                  <Button
                    variant="ghost"
                    onClick={() => {
                      handleInstallAPK();
                      setMobileMenuOpen(false);
                    }}
                    className="w-full justify-start min-h-[48px] text-base"
                  >
                    <Download className="w-5 h-5 mr-3" />
                    Install App
                  </Button>
                  
                  <Button
                    variant="ghost"
                    onClick={handleSignOut}
                    className="w-full justify-start min-h-[48px] text-base text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <LogOut className="w-5 h-5 mr-3" />
                    Sign Out
                  </Button>
                </div>

                {/* Time Display on Mobile */}
                <div className="absolute bottom-4 left-4 right-4 p-3 rounded-lg bg-muted/50 text-center">
                  <p className="text-xs text-muted-foreground">{formatDate(currentTime)}</p>
                  <p className="text-lg font-mono font-semibold">{formatTime(currentTime)}</p>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>

      {/* User List Dialog - TL/VC Only */}
      {isCaptainOrVice && (
        <Dialog open={userListOpen} onOpenChange={setUserListOpen}>
          <DialogContent className="max-w-4xl w-[95vw] max-h-[90vh] overflow-hidden p-0 sm:p-6">
            <DialogHeader className="p-4 sm:p-0 border-b sm:border-0">
              <DialogTitle className="flex items-center gap-2">
                <UserCog className="w-5 h-5" />
                User Management
              </DialogTitle>
            </DialogHeader>
            <div className="overflow-y-auto max-h-[calc(90vh-120px)] sm:max-h-[calc(90vh-100px)] p-4 sm:p-0">
              <UserListPanel onClose={() => setUserListOpen(false)} />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </header>
  );
}
