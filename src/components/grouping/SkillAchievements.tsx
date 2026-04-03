import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useSkillTracks } from '@/hooks/useSkillTracks';
import { useSkillStreaks } from '@/hooks/useSkillStreaks';
import { useSkillLevels } from '@/hooks/useSkillLevels';

interface AchievementDef {
  id: string;
  name: string;
  icon: string;
  description: string;
  check: (ctx: AchievementCtx) => boolean;
  tier: 'bronze' | 'silver' | 'gold' | 'platinum';
}

interface AchievementCtx {
  totalTracks: number;
  completedSteps: number;
  totalSteps: number;
  xp: number;
  level: number;
  streak: number;
  longestStreak: number;
  totalLinks: number;
}

const TIER_STYLES: Record<string, string> = {
  bronze: 'from-amber-700/80 to-amber-900/60 border-amber-600/50 shadow-amber-900/20',
  silver: 'from-slate-300/80 to-slate-500/60 border-slate-400/50 shadow-slate-500/20',
  gold: 'from-yellow-400/80 to-amber-500/60 border-yellow-500/50 shadow-yellow-500/30',
  platinum: 'from-violet-400/80 to-indigo-500/60 border-violet-500/50 shadow-violet-500/30',
};

const TIER_GLOW: Record<string, string> = {
  bronze: '',
  silver: '',
  gold: 'drop-shadow(0 0 6px hsl(38 92% 50% / 0.4))',
  platinum: 'drop-shadow(0 0 8px hsl(270 85% 60% / 0.5))',
};

const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first_skill', name: 'Trailblazer', icon: '🗺️', description: 'Add your first skill track', check: c => c.totalTracks >= 1, tier: 'bronze' },
  { id: 'five_skills', name: 'Polymath', icon: '🧠', description: 'Track 5 different skills', check: c => c.totalTracks >= 5, tier: 'silver' },
  { id: 'first_step', name: 'First Steps', icon: '👣', description: 'Complete your first learning step', check: c => c.completedSteps >= 1, tier: 'bronze' },
  { id: 'ten_steps', name: 'Marathoner', icon: '🏃', description: 'Complete 10 learning steps', check: c => c.completedSteps >= 10, tier: 'silver' },
  { id: 'fifty_steps', name: 'Iron Will', icon: '⚔️', description: 'Complete 50 learning steps', check: c => c.completedSteps >= 50, tier: 'gold' },
  { id: 'streak_3', name: 'On Fire', icon: '🔥', description: '3-week activity streak', check: c => c.streak >= 3, tier: 'bronze' },
  { id: 'streak_8', name: 'Unstoppable', icon: '💎', description: '8-week activity streak', check: c => c.longestStreak >= 8, tier: 'gold' },
  { id: 'level_5', name: 'Skilled', icon: '⭐', description: 'Reach Level 5', check: c => c.level >= 5, tier: 'silver' },
  { id: 'level_10', name: 'Grandmaster', icon: '👑', description: 'Reach Level 10 (Max)', check: c => c.level >= 10, tier: 'platinum' },
  { id: 'xp_1000', name: 'XP Hunter', icon: '⚡', description: 'Earn 1,000 XP', check: c => c.xp >= 1000, tier: 'silver' },
  { id: 'xp_5000', name: 'Legend', icon: '🏆', description: 'Earn 5,000 XP', check: c => c.xp >= 5000, tier: 'platinum' },
  { id: 'reflection', name: 'Reflective', icon: '💭', description: 'Write your first reflection', check: c => c.reflections >= 1, tier: 'bronze' },
];

interface SkillAchievementsProps {
  sessionId: string;
  userId: string;
}

export function SkillAchievements({ sessionId, userId }: SkillAchievementsProps) {
  const { tracks } = useSkillTracks(sessionId, userId);
  const { streak } = useSkillStreaks(sessionId, userId);
  const { level } = useSkillLevels(sessionId, userId);
  const { reflections } = useSkillReflections();

  const ctx: AchievementCtx = useMemo(() => ({
    totalTracks: tracks.length,
    completedSteps: 0, // Will be computed from flowchart blocks
    totalSteps: 0,
    xp: level?.xp || 0,
    level: level?.level || 1,
    streak: streak?.current_streak || 0,
    longestStreak: streak?.longest_streak || 0,
    reflections: reflections?.length || 0,
    totalLinks: 0,
  }), [tracks, streak, level, reflections]);

  const earned = ACHIEVEMENTS.filter(a => a.check(ctx));
  const locked = ACHIEVEMENTS.filter(a => !a.check(ctx));

  return (
    <TooltipProvider>
      <div className="space-y-3">
        {/* Earned Badges */}
        {earned.length > 0 && (
          <div className="space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-primary/70">
              🏅 Earned ({earned.length}/{ACHIEVEMENTS.length})
            </p>
            <div className="flex flex-wrap gap-2">
              {earned.map(a => (
                <Tooltip key={a.id}>
                  <TooltipTrigger asChild>
                    <div
                      className={`relative w-12 h-12 rounded-xl bg-gradient-to-br ${TIER_STYLES[a.tier]} border flex items-center justify-center cursor-default transition-transform hover:scale-110 animate-in zoom-in duration-300`}
                      style={{ filter: TIER_GLOW[a.tier] }}
                    >
                      <span className="text-lg">{a.icon}</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-[200px]">
                    <p className="text-xs font-bold">{a.name}</p>
                    <p className="text-[10px] text-muted-foreground">{a.description}</p>
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>
          </div>
        )}

        {/* Locked Badges */}
        {locked.length > 0 && (
          <div className="space-y-2">
            <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground/50">
              🔒 Locked ({locked.length})
            </p>
            <div className="flex flex-wrap gap-2">
              {locked.map(a => (
                <Tooltip key={a.id}>
                  <TooltipTrigger asChild>
                    <div className="w-12 h-12 rounded-xl bg-muted/30 border border-border/30 flex items-center justify-center opacity-30 grayscale cursor-default">
                      <span className="text-lg">{a.icon}</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-[200px]">
                    <p className="text-xs font-bold">{a.name}</p>
                    <p className="text-[10px] text-muted-foreground">{a.description}</p>
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
