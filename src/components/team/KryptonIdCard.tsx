import { User } from 'lucide-react';
import { ROLE_LABELS, KryptonRole, STATUS_LABELS, TaskStatus } from '@/lib/constants';
import { format } from 'date-fns';

interface KryptonIdCardProps {
  profile: {
    user_id: string;
    full_name: string;
    email: string;
    department: string;
    avatar_url: string | null;
    current_status: TaskStatus | null;
    created_at: string;
  };
  role: KryptonRole | null;
  onClick?: () => void;
  compact?: boolean;
}

function getRoleBgClass(role: KryptonRole | null): string {
  switch (role) {
    case 'team_captain': return 'bg-[hsl(var(--role-captain))]';
    case 'vice_captain': return 'bg-[hsl(var(--role-vice-captain))]';
    case 'strategist': return 'bg-[hsl(var(--role-strategist))]';
    case 'team_manager': return 'bg-[hsl(var(--role-manager))]';
    case 'team_member': return 'bg-[hsl(var(--role-member))]';
    default: return 'bg-muted';
  }
}

function getStatusClass(status: TaskStatus | null): string {
  switch (status) {
    case 'working': return 'status-badge status-working';
    case 'completed': return 'status-badge status-completed';
    case 'pending': return 'status-badge status-pending';
    default: return 'status-badge status-idle';
  }
}

export function KryptonIdCard({ profile, role, onClick, compact }: KryptonIdCardProps) {
  if (compact) {
    return (
      <div 
        onClick={onClick}
        className={`flex items-center gap-3 p-3 rounded-lg border bg-card hover:shadow-md transition-all cursor-pointer ${onClick ? 'hover:border-primary/50' : ''}`}
      >
        <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center overflow-hidden">
          {profile.avatar_url ? (
            <img src={profile.avatar_url} alt={profile.full_name} className="w-full h-full object-cover" />
          ) : (
            <User className="w-5 h-5 text-muted-foreground" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium truncate">{profile.full_name}</p>
          <p className="text-xs text-muted-foreground truncate">{role ? ROLE_LABELS[role] : 'Member'}</p>
        </div>
        <span className={getStatusClass(profile.current_status)}>
          {STATUS_LABELS[profile.current_status || 'idle']}
        </span>
      </div>
    );
  }

  return (
    <div 
      onClick={onClick}
      className={`relative overflow-hidden rounded-xl border bg-card shadow-sm transition-all ${onClick ? 'cursor-pointer hover:shadow-lg hover:-translate-y-1' : ''}`}
    >
      {/* Role Color Strip */}
      <div className={`h-2 ${getRoleBgClass(role)}`} />
      
      <div className="p-5">
        {/* Avatar and Name */}
        <div className="flex flex-col items-center text-center mb-4">
          <div className="w-20 h-20 rounded-full bg-muted border-4 border-background shadow-md flex items-center justify-center overflow-hidden -mt-12 mb-3">
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt={profile.full_name} className="w-full h-full object-cover" />
            ) : (
              <User className="w-10 h-10 text-muted-foreground" />
            )}
          </div>
          <h3 className="font-display font-semibold text-lg">{profile.full_name}</h3>
          {role && (
            <span className={`role-badge mt-1 ${
              role === 'team_captain' ? 'role-captain' :
              role === 'vice_captain' ? 'role-vice-captain' :
              role === 'strategist' ? 'role-strategist' :
              role === 'team_manager' ? 'role-manager' : 'role-member'
            }`}>
              {ROLE_LABELS[role]}
            </span>
          )}
        </div>

        {/* Details */}
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Department</span>
            <span className="font-medium">{profile.department}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Email</span>
            <span className="font-medium truncate max-w-[150px]">{profile.email}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Joined</span>
            <span className="font-medium">{format(new Date(profile.created_at), 'MMM yyyy')}</span>
          </div>
          <div className="flex justify-between items-center pt-2 border-t">
            <span className="text-muted-foreground">Status</span>
            <span className={getStatusClass(profile.current_status)}>
              {STATUS_LABELS[profile.current_status || 'idle']}
            </span>
          </div>
        </div>
      </div>

      {/* Krypton ID Footer */}
      <div className="px-5 py-2 bg-muted/50 border-t text-center">
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
          Krypton ID
        </span>
      </div>
    </div>
  );
}
