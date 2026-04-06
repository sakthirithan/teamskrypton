import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Zap, Star, TrendingUp, Sparkles, Clock } from 'lucide-react';
import { 
  useSkillLevels, 
  LEVEL_NAMES, 
  LEVEL_COLORS, 
  getXpProgress, 
  getXpForNextLevel,
  LEVEL_THRESHOLDS,
  SkillXpLog,
} from '@/hooks/useSkillLevels';
import { formatDistanceToNow } from 'date-fns';

interface SkillLevelBadgeProps {
  sessionId: string;
  userId: string;
  compact?: boolean;
}

export function SkillLevelBadge({ sessionId, userId, compact = false }: SkillLevelBadgeProps) {
  const { level, xpLog, isLoading } = useSkillLevels(sessionId, userId);
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [prevLevel, setPrevLevel] = useState<number | null>(null);

  const currentXp = level?.xp || 0;
  const currentLevel = level?.level || 1;
  const progress = getXpProgress(currentXp, currentLevel);
  const nextThreshold = currentLevel < LEVEL_THRESHOLDS.length 
    ? LEVEL_THRESHOLDS[currentLevel] 
    : LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1];
  const currentThreshold = LEVEL_THRESHOLDS[currentLevel - 1] || 0;

  // Level-up animation
  useEffect(() => {
    if (prevLevel !== null && currentLevel > prevLevel) {
      setShowLevelUp(true);
      setTimeout(() => setShowLevelUp(false), 3000);
    }
    setPrevLevel(currentLevel);
  }, [currentLevel]);

  if (isLoading) return null;

  if (compact) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="outline" className={`gap-1 text-[10px] px-1.5 py-0 ${LEVEL_COLORS[currentLevel - 1]}`}>
              <Zap className="w-2.5 h-2.5" />
              Lv.{currentLevel}
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-xs">{LEVEL_NAMES[currentLevel - 1]} • {currentXp} XP</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  const activityTypeLabels: Record<string, string> = {
    flowchart_step: '📚 Learning Step',
    reflection: '💭 Reflection',
    endorsement_received: '👍 Endorsement',
    dev_link: '🔗 Dev Link',
    streak_bonus: '🔥 Streak Bonus',
    ps_completed: '✅ PS Completed',
    challenge_easy: '⚡ Easy Challenge',
    challenge_medium: '⚡ Medium Challenge',
    challenge_hard: '⚡ Hard Challenge',
  };

  return (
    <Card className="overflow-hidden relative">
      {/* Level-up animation overlay */}
      {showLevelUp && (
        <div className="absolute inset-0 z-10 bg-primary/10 backdrop-blur-sm flex items-center justify-center animate-fade-in">
          <div className="text-center space-y-2 animate-bounce">
            <Sparkles className="w-10 h-10 text-amber-500 mx-auto" />
            <p className="text-lg font-bold text-primary">Level Up!</p>
            <p className="text-sm text-muted-foreground">You reached {LEVEL_NAMES[currentLevel - 1]}</p>
          </div>
        </div>
      )}

      <CardContent className="p-4 space-y-3">
        {/* Level Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg bg-primary/10 ${LEVEL_COLORS[currentLevel - 1]}`}>
              {currentLevel}
            </div>
            <div>
              <p className="text-sm font-semibold">{LEVEL_NAMES[currentLevel - 1]}</p>
              <p className="text-xs text-muted-foreground">Level {currentLevel}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm font-bold tabular-nums">{currentXp} XP</p>
            <p className="text-[10px] text-muted-foreground">
              {currentLevel < LEVEL_THRESHOLDS.length 
                ? `${nextThreshold - currentXp} to next`
                : 'Max level!'}
            </p>
          </div>
        </div>

        {/* XP Progress Bar */}
        <div className="space-y-1">
          <Progress value={Math.max(0, Math.min(100, progress))} className="h-2.5" />
          <div className="flex justify-between text-[10px] text-muted-foreground tabular-nums">
            <span>{currentXp - currentThreshold} / {nextThreshold - currentThreshold} XP</span>
            <span>{Math.round(Math.max(0, Math.min(100, progress)))}%</span>
          </div>
        </div>

        {/* Recent XP Activity */}
        {xpLog.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <Clock className="w-3 h-3" /> Recent Activity
            </p>
            <ScrollArea className="max-h-[120px]">
              <div className="space-y-1">
                {xpLog.slice(0, 5).map((log) => (
                  <div key={log.id} className="flex items-center justify-between text-xs py-1 px-2 rounded-md bg-muted/30">
                    <span className="truncate">
                      {activityTypeLabels[log.activity_type] || log.activity_type}
                    </span>
                    <span className="font-medium text-emerald-600 shrink-0 ml-2">+{log.xp_amount}</span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
