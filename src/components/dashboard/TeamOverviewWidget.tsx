import { memo, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Users, 
  User,
  ChevronRight,
  Activity,
  Clock
} from 'lucide-react';
import { ROLE_LABELS, KryptonRole, LEADERSHIP_ROLES } from '@/lib/constants';

interface TeamMember {
  user_id: string;
  full_name: string;
  role: KryptonRole | null;
  current_task_status?: 'idle' | 'working' | 'pending' | null;
  current_task_title?: string | null;
}

interface TeamOverviewWidgetProps {
  members: TeamMember[];
  workingTasks: Array<{ assigned_to: string; title: string }>;
}

/**
 * Team Overview Widget - Quick view of team members and their current status
 * Optimized with memoization for performance
 */
export const TeamOverviewWidget = memo(function TeamOverviewWidget({
  members,
  workingTasks
}: TeamOverviewWidgetProps) {
  const navigate = useNavigate();

  // Merge task data with members for display
  const enrichedMembers = useMemo(() => {
    const taskMap = new Map(workingTasks.map(t => [t.assigned_to, t.title]));
    
    return members
      .map(member => ({
        ...member,
        isWorking: taskMap.has(member.user_id),
        currentTask: taskMap.get(member.user_id) || null
      }))
      .sort((a, b) => {
        // Sort: working first, then leadership, then alphabetically
        if (a.isWorking !== b.isWorking) return b.isWorking ? 1 : -1;
        const aIsLeader = a.role && LEADERSHIP_ROLES.includes(a.role);
        const bIsLeader = b.role && LEADERSHIP_ROLES.includes(b.role);
        if (aIsLeader !== bIsLeader) return aIsLeader ? -1 : 1;
        return a.full_name.localeCompare(b.full_name);
      });
  }, [members, workingTasks]);

  const workingCount = useMemo(() => 
    enrichedMembers.filter(m => m.isWorking).length,
    [enrichedMembers]
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-lg font-display">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Team Overview
          </div>
          <Badge variant="secondary" className="text-xs">
            {workingCount} active
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[280px]">
          <div className="px-4 pb-4 space-y-1">
            {enrichedMembers.map((member) => (
              <div
                key={member.user_id}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer group"
                onClick={() => navigate(`/member/${member.user_id}`)}
              >
                {/* Avatar */}
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  member.isWorking 
                    ? 'bg-[hsl(var(--status-working))]/20 ring-2 ring-[hsl(var(--status-working))]' 
                    : 'bg-muted'
                }`}>
                  <User className={`w-4 h-4 ${
                    member.isWorking 
                      ? 'text-[hsl(var(--status-working))]' 
                      : 'text-muted-foreground'
                  }`} />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm truncate">
                      {member.full_name}
                    </span>
                    {member.isWorking && (
                      <Activity className="h-3 w-3 text-[hsl(var(--status-working))] animate-pulse" />
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{member.role ? ROLE_LABELS[member.role] : 'Member'}</span>
                    {member.currentTask && (
                      <>
                        <span>•</span>
                        <span className="truncate max-w-[120px] flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {member.currentTask}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* Status & Action */}
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>
            ))}

            {enrichedMembers.length === 0 && (
              <div className="text-center py-8 text-muted-foreground text-sm">
                No team members found
              </div>
            )}
          </div>
        </ScrollArea>
        
        {/* Quick Action */}
        <div className="px-4 py-3 border-t bg-muted/30">
          <Button 
            variant="ghost" 
            size="sm" 
            className="w-full"
            onClick={() => navigate('/team')}
          >
            View Full Team
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
});
