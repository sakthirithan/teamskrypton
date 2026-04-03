import { useMemo } from 'react';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Zap, Flame, Trophy, Star, TrendingUp } from 'lucide-react';
import { useSkillLevels, LEVEL_NAMES, getXpProgress, LEVEL_THRESHOLDS } from '@/hooks/useSkillLevels';
import { useSkillStreaks } from '@/hooks/useSkillStreaks';
import { useSkillTracks } from '@/hooks/useSkillTracks';

interface SkillHeroCardProps {
  sessionId: string;
  userId: string;
  userName?: string;
}

export function SkillHeroCard({ sessionId, userId, userName }: SkillHeroCardProps) {
  const { level } = useSkillLevels(sessionId, userId);
  const { streak } = useSkillStreaks(sessionId, userId);
  const { tracks } = useSkillTracks(sessionId, userId);

  const currentXp = level?.xp || 0;
  const currentLevel = level?.level || 1;
  const progress = getXpProgress(currentXp, currentLevel);
  const nextThreshold = currentLevel < LEVEL_THRESHOLDS.length ? LEVEL_THRESHOLDS[currentLevel] : LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1];
  const currentThreshold = LEVEL_THRESHOLDS[currentLevel - 1] || 0;
  const xpToNext = nextThreshold - currentXp;
  const currentStreak = streak?.current_streak || 0;

  const levelName = LEVEL_NAMES[currentLevel - 1] || 'Beginner';

  // Neon color by level tier
  const tierColor = currentLevel <= 3 ? 'hsl(var(--success))' :
    currentLevel <= 6 ? 'hsl(var(--info))' :
    currentLevel <= 8 ? 'hsl(var(--accent))' :
    'hsl(var(--warning))';

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/40 bg-gradient-to-br from-card via-card to-muted/30 p-4 sm:p-5">
      {/* Decorative glow */}
      <div className="absolute -top-20 -right-20 w-40 h-40 rounded-full opacity-10 blur-3xl pointer-events-none"
        style={{ background: tierColor }} />
      <div className="absolute -bottom-10 -left-10 w-32 h-32 rounded-full opacity-5 blur-2xl pointer-events-none"
        style={{ background: 'hsl(var(--primary))' }} />

      <div className="relative z-10 flex items-start gap-4">
        {/* Level Circle */}
        <div className="relative shrink-0">
          <div
            className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl flex items-center justify-center font-black text-2xl sm:text-3xl border-2 transition-all duration-500"
            style={{
              borderColor: tierColor,
              background: `linear-gradient(135deg, ${tierColor}15, ${tierColor}05)`,
              color: tierColor,
              boxShadow: `0 0 20px ${tierColor}20, inset 0 0 20px ${tierColor}05`,
            }}
          >
            {currentLevel}
          </div>
          {currentStreak > 0 && (
            <div className="absolute -top-1.5 -right-1.5 flex items-center gap-0.5 bg-card border border-border rounded-full px-1.5 py-0.5 shadow-md">
              <Flame className="w-3 h-3 text-[hsl(var(--warning))]" />
              <span className="text-[10px] font-bold text-[hsl(var(--warning))]">{currentStreak}w</span>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm sm:text-base font-bold tracking-tight" style={{ color: tierColor }}>
              {levelName}
            </h3>
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-0.5 border-primary/30">
              <Zap className="w-2.5 h-2.5" />
              {currentXp.toLocaleString()} XP
            </Badge>
          </div>

          {/* XP Progress Bar */}
          <div className="space-y-1">
            <div className="relative h-3 rounded-full bg-muted/60 overflow-hidden border border-border/30">
              <div
                className="h-full rounded-full transition-all duration-1000 ease-out relative overflow-hidden"
                style={{
                  width: `${progress}%`,
                  background: `linear-gradient(90deg, ${tierColor}80, ${tierColor})`,
                  boxShadow: `0 0 10px ${tierColor}40`,
                }}
              >
                {/* Animated shimmer */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-[shimmer_2s_infinite] -translate-x-full" />
              </div>
            </div>
            <div className="flex justify-between text-[10px] text-muted-foreground tabular-nums">
              <span>{currentThreshold} XP</span>
              <span className="font-medium">
                {currentLevel >= 10 ? '✨ MAX LEVEL' : `${xpToNext} XP to next`}
              </span>
              <span>{nextThreshold} XP</span>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="flex items-center gap-3 text-[11px]">
            <span className="flex items-center gap-1 text-muted-foreground">
              <Star className="w-3 h-3 text-[hsl(var(--warning))]" />
              {tracks.filter(t => t.is_primary).length} primary
            </span>
            <span className="flex items-center gap-1 text-muted-foreground">
              <TrendingUp className="w-3 h-3 text-[hsl(var(--success))]" />
              {tracks.length} skills
            </span>
            {streak?.longest_streak ? (
              <span className="flex items-center gap-1 text-muted-foreground">
                <Trophy className="w-3 h-3 text-[hsl(var(--warning))]" />
                Best: {streak.longest_streak}w
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
