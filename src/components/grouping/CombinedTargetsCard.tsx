import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Target, Users, User, TrendingUp } from 'lucide-react';
import { GroupingTarget } from '@/hooks/useGroupingTargets';
import { GroupingSession } from '@/hooks/useGroupingSessions';
import { 
  calculateSessionDays, 
  calculateDaysRemaining, 
  calculateTargetStatus,
  TARGET_STATUS_LABELS 
} from '@/lib/groupingConstants';

interface CombinedTargetsCardProps {
  session: GroupingSession | null;
  individualTarget?: GroupingTarget | null;
  groupTarget?: GroupingTarget | null;
  achievedPoints: number;
  groupAchievedPoints?: number;
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'on_track': return 'text-green-600 bg-green-500/10 border-green-500/20';
    case 'at_risk': return 'text-yellow-600 bg-yellow-500/10 border-yellow-500/20';
    case 'behind': return 'text-red-600 bg-red-500/10 border-red-500/20';
    default: return 'text-muted-foreground bg-muted';
  }
}

export function CombinedTargetsCard({ 
  session, 
  individualTarget, 
  groupTarget,
  achievedPoints,
  groupAchievedPoints = 0
}: CombinedTargetsCardProps) {
  if (!session) return null;
  
  const totalDays = calculateSessionDays(session.start_date, session.end_date);
  const daysRemaining = calculateDaysRemaining(session.end_date);
  
  // Individual target calculations
  const individualTargetPoints = individualTarget?.target_points || 0;
  const individualProgress = individualTargetPoints > 0 
    ? Math.min(100, (achievedPoints / individualTargetPoints) * 100) 
    : 0;
  const individualStatus = calculateTargetStatus(achievedPoints, individualTargetPoints, daysRemaining, totalDays);
  
  // Group target calculations
  const groupTargetPoints = groupTarget?.target_points || 0;
  const groupProgress = groupTargetPoints > 0 
    ? Math.min(100, (groupAchievedPoints / groupTargetPoints) * 100) 
    : 0;
  const groupStatus = calculateTargetStatus(groupAchievedPoints, groupTargetPoints, daysRemaining, totalDays);
  
  const hasIndividualTarget = !!individualTarget;
  const hasGroupTarget = !!groupTarget;
  
  if (!hasIndividualTarget && !hasGroupTarget) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-6 text-center">
          <Target className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">No targets assigned for this session</p>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Target className="w-4 h-4 text-primary" />
          Session Targets
          <Badge variant="outline" className="ml-auto text-xs">
            {daysRemaining} days left
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Individual Target */}
        {hasIndividualTarget && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-blue-500" />
                <span className="text-sm font-medium">Individual Target</span>
              </div>
              <Badge variant="outline" className={getStatusColor(individualStatus)}>
                {TARGET_STATUS_LABELS[individualStatus]}
              </Badge>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{achievedPoints} / {individualTargetPoints} pts</span>
                <span>{individualProgress.toFixed(0)}%</span>
              </div>
              <Progress 
                value={individualProgress} 
                className="h-2"
              />
            </div>
          </div>
        )}
        
        {/* Group Target */}
        {hasGroupTarget && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-purple-500" />
                <span className="text-sm font-medium">Group Target</span>
              </div>
              <Badge variant="outline" className={getStatusColor(groupStatus)}>
                {TARGET_STATUS_LABELS[groupStatus]}
              </Badge>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{groupAchievedPoints} / {groupTargetPoints} pts</span>
                <span>{groupProgress.toFixed(0)}%</span>
              </div>
              <Progress 
                value={groupProgress} 
                className="h-2"
              />
            </div>
          </div>
        )}
        
        {/* Combined Summary */}
        {hasIndividualTarget && hasGroupTarget && (
          <div className="pt-2 border-t flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              Combined Progress
            </span>
            <span className="font-medium">
              {achievedPoints + groupAchievedPoints} total pts achieved
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
