import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Flame, 
  TrendingUp, 
  Award, 
  Calendar,
  BarChart3,
  Zap
} from 'lucide-react';
import { PSDailyEntry } from '@/hooks/usePSDailyEntries';
import { GroupingSession } from '@/hooks/useGroupingSessions';
import { calculateDaysRemaining, calculateSessionDays } from '@/lib/groupingConstants';
import { format, differenceInDays, parseISO } from 'date-fns';

interface ProductivityInsightsProps {
  entries: PSDailyEntry[];
  session: GroupingSession | null;
  targetPoints: number;
  achievedPoints: number;
}

export function ProductivityInsights({ 
  entries, 
  session, 
  targetPoints, 
  achievedPoints 
}: ProductivityInsightsProps) {
  const insights = useMemo(() => {
    if (!session || entries.length === 0) return null;

    const completedEntries = entries.filter(e => e.status === 'completed');
    const totalDays = calculateSessionDays(session.start_date, session.end_date);
    const daysRemaining = calculateDaysRemaining(session.end_date);
    const daysElapsed = totalDays - daysRemaining;

    // Daily average points
    const dailyAvg = daysElapsed > 0 ? achievedPoints / daysElapsed : 0;

    // Required daily rate to hit target
    const pointsNeeded = targetPoints - achievedPoints;
    const requiredDailyRate = daysRemaining > 0 ? pointsNeeded / daysRemaining : 0;

    // Streak calculation - consecutive days with completed entries
    const completedDates = [...new Set(
      completedEntries.map(e => e.entry_date)
    )].sort().reverse();
    
    let streak = 0;
    const today = format(new Date(), 'yyyy-MM-dd');
    let checkDate = today;
    
    for (const date of completedDates) {
      if (date === checkDate || differenceInDays(parseISO(checkDate), parseISO(date)) <= 1) {
        streak++;
        checkDate = date;
      } else {
        break;
      }
    }

    // Top skill by frequency
    const skillMap = new Map<string, number>();
    completedEntries.forEach(e => {
      skillMap.set(e.skill_name, (skillMap.get(e.skill_name) || 0) + 1);
    });
    const topSkill = [...skillMap.entries()].sort((a, b) => b[1] - a[1])[0];

    // Completion rate
    const totalEntries = entries.length;
    const completionRate = totalEntries > 0 ? (completedEntries.length / totalEntries) * 100 : 0;

    // Projected finish
    const projectedTotal = dailyAvg * totalDays;
    const willHitTarget = projectedTotal >= targetPoints;

    return {
      dailyAvg: Math.round(dailyAvg * 10) / 10,
      requiredDailyRate: Math.round(requiredDailyRate * 10) / 10,
      streak,
      topSkill: topSkill ? { name: topSkill[0], count: topSkill[1] } : null,
      completionRate: Math.round(completionRate),
      willHitTarget,
      projectedTotal: Math.round(projectedTotal),
      totalCompleted: completedEntries.length,
    };
  }, [entries, session, targetPoints, achievedPoints]);

  if (!insights || !session) return null;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <div className="p-1.5 rounded-lg bg-primary/10">
            <BarChart3 className="w-4 h-4 text-primary" />
          </div>
          Productivity Insights
          {insights.willHitTarget ? (
            <Badge className="ml-auto bg-emerald-500/15 text-emerald-600 border-emerald-500/30">
              On Track
            </Badge>
          ) : (
            <Badge className="ml-auto bg-amber-500/15 text-amber-600 border-amber-500/30">
              Needs Push
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {/* Daily Average */}
          <div className="p-3 rounded-xl bg-muted/30 border border-border/40 space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <TrendingUp className="w-3 h-3" />
              Daily Avg
            </div>
            <p className="text-lg font-bold tabular-nums">{insights.dailyAvg}</p>
            <p className="text-xs text-muted-foreground">pts/day</p>
          </div>

          {/* Required Rate */}
          <div className="p-3 rounded-xl bg-muted/30 border border-border/40 space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Zap className="w-3 h-3" />
              Need Rate
            </div>
            <p className="text-lg font-bold tabular-nums">{insights.requiredDailyRate}</p>
            <p className="text-xs text-muted-foreground">pts/day needed</p>
          </div>

          {/* Streak */}
          <div className="p-3 rounded-xl bg-muted/30 border border-border/40 space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Flame className="w-3 h-3" />
              Streak
            </div>
            <p className="text-lg font-bold tabular-nums">{insights.streak}</p>
            <p className="text-xs text-muted-foreground">consecutive days</p>
          </div>

          {/* Completion Rate */}
          <div className="p-3 rounded-xl bg-muted/30 border border-border/40 space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Award className="w-3 h-3" />
              Completion
            </div>
            <div className="flex items-baseline gap-1">
              <p className="text-lg font-bold tabular-nums">{insights.completionRate}%</p>
            </div>
            <Progress value={insights.completionRate} className="h-1.5" />
          </div>

          {/* Top Skill */}
          {insights.topSkill && (
            <div className="p-3 rounded-xl bg-muted/30 border border-border/40 space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Calendar className="w-3 h-3" />
                Top Skill
              </div>
              <p className="text-sm font-bold truncate">{insights.topSkill.name}</p>
              <p className="text-xs text-muted-foreground">{insights.topSkill.count} entries</p>
            </div>
          )}

          {/* Projected */}
          <div className="p-3 rounded-xl bg-muted/30 border border-border/40 space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <TrendingUp className="w-3 h-3" />
              Projected
            </div>
            <p className="text-lg font-bold tabular-nums">{insights.projectedTotal}</p>
            <p className="text-xs text-muted-foreground">total pts at this pace</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}