import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { ROLE_LABELS, KryptonRole } from '@/lib/constants';
import { LogOut, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

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
  const { profile, role, signOut } = useAuth();
  const navigate = useNavigate();
  const [currentTime, setCurrentTime] = useState(new Date());

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

  return (
    <header className="krypton-gradient text-primary-foreground">
      <div className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Logo and Title */}
          <div className="flex items-center gap-4">
            <div className="flex flex-col">
              <h1 className="text-2xl font-display font-bold tracking-tight">
                Krypton Space
              </h1>
              <p className="text-sm opacity-80">Where Work Becomes Visible</p>
            </div>
          </div>

          {/* Date and Time */}
          <div className="hidden md:flex flex-col items-center">
            <span className="text-sm opacity-80">{formatDate(currentTime)}</span>
            <span className="text-xl font-mono font-semibold">{formatTime(currentTime)}</span>
          </div>

          {/* User Info */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex flex-col items-end">
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
          </div>
        </div>
      </div>
    </header>
  );
}
