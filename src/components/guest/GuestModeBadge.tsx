import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FlaskConical, ChevronDown, Check, Info } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useGuestUser, KryptonRole } from '@/hooks/useGuestUser';
import { ROLE_LABELS } from '@/lib/constants';

const AVAILABLE_ROLES: KryptonRole[] = [
  'team_captain',
  'vice_captain',
  'strategist',
  'team_manager',
  'team_member',
];

export function GuestModeBadge() {
  const { 
    isGuest, 
    isPrimaryTest, 
    isSecondaryTest,
    simulatedRole,
    expiresAt,
    switchSimulatedRole,
    getEffectiveRole,
  } = useGuestUser();
  
  const [isOpen, setIsOpen] = useState(false);

  if (!isGuest) return null;

  const effectiveRole = getEffectiveRole();
  const badgeLabel = isPrimaryTest ? '🧪 Primary Guest' : '🧪 Secondary Guest';

  const handleRoleSwitch = async (role: KryptonRole) => {
    const success = await switchSimulatedRole(role);
    if (success) {
      setIsOpen(false);
      // Reload the page to apply new simulated role
      window.location.reload();
    }
  };

  // Secondary test users: non-interactive badge
  if (isSecondaryTest) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge 
            variant="outline" 
            className="bg-amber-500/10 text-amber-700 border-amber-500/30 cursor-help"
          >
            <FlaskConical className="w-3 h-3 mr-1" />
            {badgeLabel}
          </Badge>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <p className="font-medium">Test Account (Secondary)</p>
          <p className="text-xs text-muted-foreground mt-1">
            You are testing the <strong>{effectiveRole ? ROLE_LABELS[effectiveRole as keyof typeof ROLE_LABELS] : 'assigned'}</strong> role.
            Real permissions are not granted.
          </p>
          {expiresAt && (
            <p className="text-xs mt-1">
              Expires: {new Date(expiresAt).toLocaleDateString()}
            </p>
          )}
        </TooltipContent>
      </Tooltip>
    );
  }

  // Primary test users: can switch roles via settings panel
  return (
    <div className="flex items-center gap-2">
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge 
            variant="outline" 
            className="bg-purple-500/10 text-purple-700 border-purple-500/30 cursor-help"
          >
            <FlaskConical className="w-3 h-3 mr-1" />
            {badgeLabel}
          </Badge>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <p className="font-medium">Test Account (Primary)</p>
          <p className="text-xs text-muted-foreground mt-1">
            You can switch simulated roles from My Space settings.
            Real permissions are not granted.
          </p>
        </TooltipContent>
      </Tooltip>
      
      {/* Simulated Role Indicator */}
      {simulatedRole && (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger asChild>
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-6 px-2 text-xs gap-1"
            >
              Simulating: {ROLE_LABELS[simulatedRole as keyof typeof ROLE_LABELS]}
              <ChevronDown className="w-3 h-3" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-2" align="end">
            <div className="space-y-1">
              <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground flex items-center gap-1">
                <Info className="w-3 h-3" />
                Switch Simulated Role
              </div>
              {AVAILABLE_ROLES.map((role) => (
                <button
                  key={role}
                  onClick={() => handleRoleSwitch(role)}
                  className={`w-full flex items-center justify-between px-2 py-1.5 text-sm rounded hover:bg-muted ${
                    simulatedRole === role ? 'bg-primary/10 text-primary' : ''
                  }`}
                >
                  {ROLE_LABELS[role as keyof typeof ROLE_LABELS]}
                  {simulatedRole === role && <Check className="w-4 h-4" />}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
