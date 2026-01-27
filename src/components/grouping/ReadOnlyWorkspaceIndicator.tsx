import { Card, CardContent } from '@/components/ui/card';
import { AlertTriangle, Eye, Lock, User } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

interface ReadOnlyWorkspaceIndicatorProps {
  viewingUserName?: string;
  isSessionClosed?: boolean;
  showReason?: boolean;
}

/**
 * Displays a read-only indicator when viewing another user's workspace
 * or when the session is closed.
 * 
 * RULES:
 * - Team Members viewing others: Always read-only
 * - Leadership viewing others: Read-only (can only view, not edit)
 * - Anyone viewing closed session: Fully read-only
 */
export function ReadOnlyWorkspaceIndicator({
  viewingUserName,
  isSessionClosed,
  showReason = true,
}: ReadOnlyWorkspaceIndicatorProps) {
  const { role } = useAuth();

  if (!viewingUserName && !isSessionClosed) return null;

  const isViewingOther = !!viewingUserName;
  
  // Determine the primary reason for read-only
  let reason = '';
  let icon = <Eye className="w-4 h-4" />;
  let colorClass = 'bg-blue-500/10 border-blue-500/20 text-blue-700 dark:text-blue-400';

  if (isSessionClosed && isViewingOther) {
    reason = `Viewing ${viewingUserName}'s workspace in a closed session. All data is read-only.`;
    icon = <Lock className="w-4 h-4" />;
    colorClass = 'bg-muted border-border text-muted-foreground';
  } else if (isSessionClosed) {
    reason = 'This session is closed. All data is read-only and cannot be modified.';
    icon = <Lock className="w-4 h-4" />;
    colorClass = 'bg-muted border-border text-muted-foreground';
  } else if (isViewingOther) {
    reason = `You are viewing ${viewingUserName}'s workspace. Only they can manage their own PS entries.`;
    icon = <Eye className="w-4 h-4" />;
    colorClass = 'bg-blue-500/10 border-blue-500/20 text-blue-700 dark:text-blue-400';
  }

  return (
    <Card className={`border ${colorClass}`}>
      <CardContent className="py-3 px-4">
        <div className="flex items-center gap-3">
          <div className="shrink-0">
            {icon}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm">Read-Only Mode</span>
            </div>
            {showReason && (
              <p className="text-xs mt-0.5 opacity-80">
                {reason}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Tooltip content for disabled actions
 */
export function getDisabledActionReason(
  action: 'add_entry' | 'edit_entry' | 'delete_entry' | 'complete_entry' | 'revert_entry' | 'create_target' | 'edit_target' | 'delete_target',
  context: {
    isViewingOther?: boolean;
    isSessionClosed?: boolean;
    isOwnEntry?: boolean;
    entryStatus?: 'pending' | 'completed';
    userRole?: string;
  }
): { disabled: boolean; reason: string; allowedBy: string } {
  const { isViewingOther, isSessionClosed, isOwnEntry, entryStatus, userRole } = context;

  // Closed session takes precedence
  if (isSessionClosed) {
    return {
      disabled: true,
      reason: 'Session is closed',
      allowedBy: 'No one (session is archived)',
    };
  }

  switch (action) {
    case 'add_entry':
      if (isViewingOther) {
        return {
          disabled: true,
          reason: "Cannot add entries to another user's workspace",
          allowedBy: 'Only the workspace owner',
        };
      }
      return { disabled: false, reason: '', allowedBy: '' };

    case 'edit_entry':
      if (isViewingOther && !['team_captain', 'vice_captain', 'strategist', 'team_manager'].includes(userRole || '')) {
        return {
          disabled: true,
          reason: "Cannot edit another user's entries",
          allowedBy: 'Leadership (TL, VC, TM, Strategist) or the entry owner',
        };
      }
      if (entryStatus === 'completed' && !['team_captain', 'vice_captain', 'strategist', 'team_manager'].includes(userRole || '')) {
        return {
          disabled: true,
          reason: 'Completed entries are locked',
          allowedBy: 'Leadership only',
        };
      }
      return { disabled: false, reason: '', allowedBy: '' };

    case 'delete_entry':
      if (isViewingOther && !['team_captain', 'vice_captain'].includes(userRole || '')) {
        return {
          disabled: true,
          reason: "Cannot delete another user's entries",
          allowedBy: 'TL or VC only',
        };
      }
      return { disabled: false, reason: '', allowedBy: '' };

    case 'complete_entry':
      if (isViewingOther) {
        return {
          disabled: true,
          reason: 'Only the entry owner can mark as completed',
          allowedBy: 'Workspace owner only',
        };
      }
      if (entryStatus === 'completed') {
        return {
          disabled: true,
          reason: 'Entry is already completed',
          allowedBy: 'N/A',
        };
      }
      return { disabled: false, reason: '', allowedBy: '' };

    case 'revert_entry':
      if (!['team_captain', 'vice_captain', 'strategist', 'team_manager'].includes(userRole || '')) {
        return {
          disabled: true,
          reason: 'Only leadership can revert entries',
          allowedBy: 'TL, VC, TM, Strategist',
        };
      }
      if (entryStatus === 'pending') {
        return {
          disabled: true,
          reason: 'Entry is already pending',
          allowedBy: 'N/A',
        };
      }
      return { disabled: false, reason: '', allowedBy: '' };

    case 'create_target':
    case 'edit_target':
      if (!['team_captain', 'vice_captain', 'strategist', 'team_manager'].includes(userRole || '')) {
        return {
          disabled: true,
          reason: 'Only leadership can manage targets',
          allowedBy: 'TL, VC, TM, Strategist',
        };
      }
      return { disabled: false, reason: '', allowedBy: '' };

    case 'delete_target':
      if (!['team_captain', 'vice_captain'].includes(userRole || '')) {
        return {
          disabled: true,
          reason: 'Only TL and VC can delete targets',
          allowedBy: 'TL, VC',
        };
      }
      return { disabled: false, reason: '', allowedBy: '' };

    default:
      return { disabled: false, reason: '', allowedBy: '' };
  }
}
