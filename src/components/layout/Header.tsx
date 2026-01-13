import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useTestSession } from '@/contexts/TestSessionContext';
import { ROLE_LABELS, KryptonRole } from '@/lib/constants';
import { LogOut, User, Users, Home, LayoutDashboard, Menu, X, FlaskConical, Download, Play, Square } from 'lucide-react';
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
  const { isTestMode, startTestSession, endTestSession } = useTestSession();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
    await signOut();
    navigate('/auth');
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
            description: "Krypton Space is being installed on your device.",
          });
        }
        (window as any).deferredPrompt = null;
      });
    } else {
      toast({
        title: "Install Krypton Space",
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

  return (
    <header className="krypton-gradient text-primary-foreground">
      <div className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Logo and Title */}
          <div className="flex items-center gap-6">
            <div className="flex flex-col">
              <h1 
                className="text-2xl font-display font-bold tracking-tight cursor-pointer"
                onClick={() => navigate('/')}
              >
                Krypton Space
              </h1>
              <p className="text-sm opacity-80">Where Work Becomes Visible</p>
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-1 ml-8">
              {navLinks.map((link) => (
                <Button
                  key={link.path}
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate(link.path)}
                  className={`text-primary-foreground hover:bg-primary-foreground/10 ${
                    isActive(link.path) ? 'bg-primary-foreground/20' : ''
                  }`}
                >
                  <link.icon className="w-4 h-4 mr-1.5" />
                  {link.label}
                </Button>
              ))}
            </nav>
          </div>

          {/* Date and Time */}
          <div className="hidden lg:flex flex-col items-center">
            <span className="text-sm opacity-80">{formatDate(currentTime)}</span>
            <span className="text-xl font-mono font-semibold">{formatTime(currentTime)}</span>
          </div>

          {/* User Info & Mobile Menu */}
          <div className="flex items-center gap-4">
            {/* User Profile Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <div className="hidden sm:flex items-center gap-3 cursor-pointer hover:opacity-80">
                  <div className="flex flex-col items-end">
                    <span className="font-medium">{profile?.full_name || 'User'}</span>
                    {role && (
                      <span className={getRoleBadgeClass(role)}>
                        {ROLE_LABELS[role]}
                      </span>
                    )}
                  </div>
                  <div className="w-10 h-10 rounded-full bg-primary-foreground/20 flex items-center justify-center">
                    <User className="w-5 h-5" />
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
                
                <DropdownMenuSeparator />
                
                {/* Test Session - Only for TL/VC */}
                {isCaptainOrVice && (
                  <>
                    {!isTestMode ? (
                      <DropdownMenuItem onClick={startTestSession} className="text-yellow-600">
                        <Play className="w-4 h-4 mr-2" />
                        Start Test Session
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem onClick={endTestSession} className="text-red-600">
                        <Square className="w-4 h-4 mr-2" />
                        End Test Session
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                  </>
                )}
                
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
              className="md:hidden text-primary-foreground hover:bg-primary-foreground/10"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <nav className="md:hidden mt-4 pt-4 border-t border-primary-foreground/20 flex flex-col gap-2">
            {navLinks.map((link) => (
              <Button
                key={link.path}
                variant="ghost"
                onClick={() => {
                  navigate(link.path);
                  setMobileMenuOpen(false);
                }}
                className={`justify-start text-primary-foreground hover:bg-primary-foreground/10 ${
                  isActive(link.path) ? 'bg-primary-foreground/20' : ''
                }`}
              >
                <link.icon className="w-4 h-4 mr-2" />
                {link.label}
              </Button>
            ))}
            
            <div className="border-t border-primary-foreground/20 pt-2 mt-2">
              {/* Test Session for mobile - TL/VC only */}
              {isCaptainOrVice && (
                !isTestMode ? (
                  <Button
                    variant="ghost"
                    onClick={() => {
                      startTestSession();
                      setMobileMenuOpen(false);
                    }}
                    className="justify-start text-yellow-300 hover:bg-primary-foreground/10 w-full"
                  >
                    <FlaskConical className="w-4 h-4 mr-2" />
                    Start Test Session
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    onClick={() => {
                      endTestSession();
                      setMobileMenuOpen(false);
                    }}
                    className="justify-start text-red-300 hover:bg-primary-foreground/10 w-full"
                  >
                    <Square className="w-4 h-4 mr-2" />
                    End Test Session
                  </Button>
                )
              )}
              
              {/* Install App for mobile */}
              <Button
                variant="ghost"
                onClick={() => {
                  handleInstallAPK();
                  setMobileMenuOpen(false);
                }}
                className="justify-start text-primary-foreground hover:bg-primary-foreground/10 w-full"
              >
                <Download className="w-4 h-4 mr-2" />
                Install App
              </Button>
              
              <Button
                variant="ghost"
                onClick={handleSignOut}
                className="justify-start text-red-300 hover:bg-primary-foreground/10 w-full"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Sign Out
              </Button>
            </div>
          </nav>
        )}
      </div>
    </header>
  );
}

