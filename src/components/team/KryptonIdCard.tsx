import { User, Eye, Phone, Pencil, CheckCircle, Power } from 'lucide-react';
import { ROLE_LABELS, KryptonRole, TaskStatus } from '@/lib/constants';
import { format } from 'date-fns';
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface KryptonIdCardProps {
  profile: {
    user_id: string;
    full_name: string;
    email: string;
    department: string;
    avatar_url: string | null;
    current_status: TaskStatus | null;
    created_at: string;
    phone_number?: string | null;
  };
  role: KryptonRole | null;
  taskStats?: {
    total: number;
    completed: number;
    inProgress: boolean;
  };
  onClick?: () => void;
  onViewProfile?: () => void;
  onUpdatePhone?: (phone: string) => Promise<void>;
  onToggleStatus?: () => Promise<void>;
  compact?: boolean;
  showProfileIcon?: boolean;
  canEditPhone?: boolean;
  isOwnProfile?: boolean;
  manualStatusOverride?: boolean; // If true, user has manually toggled status
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

// Derive status: Active if has in-progress task, otherwise Offline/Completed
// This is display-level ONLY - does NOT affect task states, logs, or system truth
function getDerivedStatus(
  taskStats?: { inProgress: boolean; completed: number },
  manualOverride?: boolean
): { label: string; className: string } {
  // If user has manually set themselves as Active (presence marker)
  if (manualOverride) {
    return { label: 'Active', className: 'status-badge status-working' };
  }
  // Otherwise derive from task status
  if (taskStats?.inProgress) {
    return { label: 'Active', className: 'status-badge status-working' };
  }
  return { label: 'Offline', className: 'status-badge status-idle' };
}

export function KryptonIdCard({ 
  profile, 
  role, 
  taskStats,
  onClick, 
  onViewProfile, 
  onUpdatePhone,
  onToggleStatus,
  compact, 
  showProfileIcon,
  canEditPhone,
  isOwnProfile,
  manualStatusOverride
}: KryptonIdCardProps) {
  const [isEditingPhone, setIsEditingPhone] = useState(false);
  const [phoneValue, setPhoneValue] = useState(profile.phone_number || '');
  const [isSaving, setIsSaving] = useState(false);
  const [isTogglingStatus, setIsTogglingStatus] = useState(false);

  const derivedStatus = getDerivedStatus(taskStats, manualStatusOverride);

  const handleToggleStatus = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onToggleStatus) return;
    setIsTogglingStatus(true);
    try {
      await onToggleStatus();
    } finally {
      setIsTogglingStatus(false);
    }
  };

  const handleSavePhone = async () => {
    if (!onUpdatePhone) return;
    setIsSaving(true);
    try {
      await onUpdatePhone(phoneValue);
      setIsEditingPhone(false);
    } finally {
      setIsSaving(false);
    }
  };

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
        <span className={derivedStatus.className}>
          {derivedStatus.label}
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
      
      {/* Profile Icon - Only visible for TL/VC */}
      {showProfileIcon && onViewProfile && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onViewProfile();
          }}
          className="absolute top-4 right-4 p-2 rounded-full bg-primary/10 hover:bg-primary/20 transition-colors"
          title="View Profile"
        >
          <Eye className="w-4 h-4 text-primary" />
        </button>
      )}
      
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
          
          {/* Phone Number - Editable by TL/VC */}
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground flex items-center gap-1">
              <Phone className="w-3 h-3" /> Phone
            </span>
            {isEditingPhone ? (
              <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                <Input 
                  value={phoneValue}
                  onChange={(e) => setPhoneValue(e.target.value)}
                  className="h-6 w-24 text-xs px-1"
                  placeholder="Phone"
                />
                <Button 
                  size="sm" 
                  variant="ghost" 
                  className="h-6 w-6 p-0"
                  onClick={handleSavePhone}
                  disabled={isSaving}
                >
                  <CheckCircle className="w-3 h-3 text-green-600" />
                </Button>
              </div>
            ) : (
              <span className="font-medium flex items-center gap-1">
                {profile.phone_number || '-'}
                {canEditPhone && onUpdatePhone && (
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsEditingPhone(true);
                    }}
                    className="p-1 hover:bg-muted rounded"
                    title="Edit phone number"
                  >
                    <Pencil className="w-3 h-3 text-muted-foreground" />
                  </button>
                )}
              </span>
            )}
          </div>
          
          <div className="flex justify-between">
            <span className="text-muted-foreground">Joined</span>
            <span className="font-medium">{format(new Date(profile.created_at), 'MMM yyyy')}</span>
          </div>
          
          {/* Derived Status - Toggleable for own profile */}
          <div className="flex justify-between items-center pt-2 border-t">
            <span className="text-muted-foreground">Status</span>
            {isOwnProfile && onToggleStatus ? (
              <button
                onClick={handleToggleStatus}
                disabled={isTogglingStatus}
                className={`${derivedStatus.className} cursor-pointer hover:opacity-80 transition-opacity flex items-center gap-1`}
                title="Toggle presence status (display only)"
              >
                {isTogglingStatus ? (
                  <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Power className="w-3 h-3" />
                )}
                {derivedStatus.label}
              </button>
            ) : (
              <span className={derivedStatus.className}>
                {derivedStatus.label}
              </span>
            )}
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