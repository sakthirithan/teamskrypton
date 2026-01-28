import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FlaskConical, Shield, Check, AlertTriangle } from 'lucide-react';
import { useGuestUser, KryptonRole } from '@/hooks/useGuestUser';
import { ROLE_LABELS } from '@/lib/constants';
import { format } from 'date-fns';

const AVAILABLE_ROLES: KryptonRole[] = [
  'team_captain',
  'vice_captain',
  'strategist',
  'team_manager',
  'team_member',
];

export function TestModeSettingsPanel() {
  const { 
    isGuest, 
    isPrimaryTest, 
    isSecondaryTest,
    simulatedRole,
    expiresAt,
    switchSimulatedRole,
  } = useGuestUser();

  if (!isGuest) return null;

  const handleRoleSwitch = async (role: KryptonRole) => {
    const success = await switchSimulatedRole(role);
    if (success) {
      // Reload the page to apply new simulated role
      window.location.reload();
    }
  };

  return (
    <Card className="border-amber-500/30 bg-amber-500/5">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <FlaskConical className="w-4 h-4 text-amber-600" />
          Test Mode Settings
          <Badge variant="outline" className="ml-auto text-xs bg-amber-500/10 text-amber-700 border-amber-500/30">
            {isPrimaryTest ? 'Primary' : 'Secondary'} Guest
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Info Banner */}
        <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
          <div className="flex gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-amber-700">You are testing this role</p>
              <p className="text-amber-600/80 text-xs mt-1">
                Real permissions are not granted. Your actions won't affect real team data.
              </p>
            </div>
          </div>
        </div>

        {/* Expiry Info */}
        {expiresAt && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Session Expires</span>
            <span className="font-medium">{format(new Date(expiresAt), 'MMM d, yyyy h:mm a')}</span>
          </div>
        )}

        {/* Current Role */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Current Simulated Role</span>
          <Badge variant="secondary" className="flex items-center gap-1">
            <Shield className="w-3 h-3" />
            {simulatedRole ? ROLE_LABELS[simulatedRole as keyof typeof ROLE_LABELS] : 'Not set'}
          </Badge>
        </div>

        {/* Role Switcher (Primary Only) */}
        {isPrimaryTest && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Switch Simulated Role</p>
            <div className="grid grid-cols-2 gap-2">
              {AVAILABLE_ROLES.map((role) => (
                <Button
                  key={role}
                  variant={simulatedRole === role ? 'default' : 'outline'}
                  size="sm"
                  className="justify-start gap-2"
                  onClick={() => handleRoleSwitch(role)}
                >
                  {simulatedRole === role && <Check className="w-3 h-3" />}
                  {ROLE_LABELS[role as keyof typeof ROLE_LABELS]}
                </Button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Switching roles will reload the page to apply the new simulated UI.
            </p>
          </div>
        )}

        {/* Secondary User Message */}
        {isSecondaryTest && (
          <div className="text-sm text-muted-foreground">
            <p>Your role is assigned by the Team Lead and cannot be changed.</p>
          </div>
        )}

        {/* Restrictions List */}
        <div className="space-y-2">
          <p className="text-sm font-medium">Restricted Actions</p>
          <ul className="text-xs text-muted-foreground space-y-1">
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-destructive"></span>
              Cannot delete real user data
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-destructive"></span>
              Cannot close sessions (except guest-created)
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-destructive"></span>
              Cannot export official team data
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-destructive"></span>
              Cannot modify real targets or progress
            </li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
