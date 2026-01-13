import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { ROLE_LABELS, KryptonRole } from '@/lib/constants';
import { LogOut, User, Users, Home, LayoutDashboard, Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate, useLocation } from 'react-router-dom';

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
  const { user, profile, role, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
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

  const navLinks = [
    { path: '/', label: 'Home', icon: Home },
    { path: '/team', label: 'Team', icon: Users },
    { path: '/my-space', label: 'My Space', icon: LayoutDashboard },
  ];

  const isActive = (path: string) => location.pathname === path;

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
            {/* User Profile */}
            <div 
              className="hidden sm:flex items-center gap-3 cursor-pointer hover:opacity-80"
              onClick={() => user && navigate('/my-space')}
            >
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

            <Button
              variant="ghost"
              size="icon"
              onClick={handleSignOut}
              className="text-primary-foreground hover:bg-primary-foreground/10"
            >
              <LogOut className="w-5 h-5" />
            </Button>

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
          </nav>
        )}
      </div>
    </header>
  );
}
