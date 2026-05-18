import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Trophy, Target, Zap, Coins } from 'lucide-react';
import type { SkillType } from '@/hooks/useMemberSkills';

interface Props {
  userId: string;
  className?: string;
  /** When true, render fewer details — e.g. for compact public-profile / team list */
  compact?: boolean;
}

const TYPE_LABEL: Record<SkillType, string> = {
  primary: 'PRIMARY',
  secondary: 'SECONDARY',
  specialization: 'SPECIALIZATION',
};

const TYPE_ACCENT: Record<SkillType, { ring: string; chip: string; text: string }> = {
  primary: {
    ring: 'border-l-indigo-500',
    chip: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
    text: 'text-indigo-600 dark:text-indigo-400',
  },
  secondary: {
    ring: 'border-l-rose-500',
    chip: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
    text: 'text-rose-600 dark:text-rose-400',
  },
  specialization: {
    ring: 'border-l-emerald-500',
    chip: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    text: 'text-emerald-600 dark:text-emerald-400',
  },
};

/**
 * Renders a member's skills as branded cards with cross-team ranking
 * (image-4 style: type chip, skill name, big number, rank).
 *
 * Ranking logic:
 *  - For every skill_name, find every user that has it (member_skills).
 *  - Score each of those users by their TOTAL XP (skill_xp_log).
 *  - Rank desc; ties keep the same rank (dense ranking).
 */
export function SkillsAndIndicatorsGrid({ userId, className, compact }: Props) {
  // The user's own skills
  const skillsQ = useQuery({
    queryKey: ['skills-grid:user', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('member_skills')
        .select('id, skill_name, skill_type')
        .eq('user_id', userId);
      if (error) throw error;
      return data as Array<{ id: string; skill_name: string; skill_type: SkillType }>;
    },
    enabled: !!userId,
  });

  // PS score per user (completed entries)
  const psQ = useQuery({
    queryKey: ['skills-grid:ps-by-user'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ps_daily_entries')
        .select('user_id, reward_points, status')
        .eq('status', 'completed');
      if (error) throw error;
      const m = new Map<string, number>();
      (data || []).forEach((r: any) => m.set(r.user_id, (m.get(r.user_id) || 0) + (r.reward_points || 0)));
      return m;
    },
    staleTime: 60_000,
  });

  // Activity points per user
  const apQ = useQuery({
    queryKey: ['skills-grid:ap-by-user'],
    queryFn: async () => {
      const { data, error } = await supabase.from('activity_points').select('user_id, points');
      if (error) throw error;
      const m = new Map<string, number>();
      (data || []).forEach((r: any) => m.set(r.user_id, (m.get(r.user_id) || 0) + (r.points || 0)));
      return m;
    },
    staleTime: 60_000,
  });

  // Golden points per user
  const gpQ = useQuery({
    queryKey: ['skills-grid:gp-by-user'],
    queryFn: async () => {
      const { data, error } = await supabase.from('user_points').select('user_id, points');
      if (error) throw error;
      const m = new Map<string, number>();
      (data || []).forEach((r: any) => m.set(r.user_id, r.points || 0));
      return m;
    },
    staleTime: 60_000,
  });

  const skills = skillsQ.data || [];

  /** Dense rank of userId within a map of user_id -> score */
  const computeRank = (m: Map<string, number>): { rank: number | null; points: number } => {
    const points = m.get(userId) || 0;
    if (m.size === 0) return { rank: null, points };
    const scored = Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
    let rank = 0;
    let last: number | null = null;
    for (const [uid, val] of scored) {
      if (val !== last) { rank += 1; last = val; }
      if (uid === userId) return { rank, points };
    }
    // user not in map
    return { rank: scored.length + 1, points };
  };

  const psRank = useMemo(() => computeRank(psQ.data || new Map()), [psQ.data, userId]);
  const apRank = useMemo(() => computeRank(apQ.data || new Map()), [apQ.data, userId]);
  const gpRank = useMemo(() => computeRank(gpQ.data || new Map()), [gpQ.data, userId]);

  if (skillsQ.isLoading) {
    return <div className={className}><div className="h-20 rounded-xl bg-muted/40 animate-pulse" /></div>;
  }

  // Sort: primary → specialization → secondary, alphabetical inside
  const order: SkillType[] = ['primary', 'secondary', 'specialization'];
  const sorted = [...skills].sort((a, b) => {
    const o = order.indexOf(a.skill_type) - order.indexOf(b.skill_type);
    return o !== 0 ? o : a.skill_name.localeCompare(b.skill_name);
  });

  const rankItems = [
    { key: 'ps', label: 'PS Score', icon: Target, color: 'text-sky-600 dark:text-sky-400', bg: 'bg-sky-500/10', data: psRank },
    { key: 'ap', label: 'Activity Points', icon: Zap, color: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-500/10', data: apRank },
    { key: 'gp', label: 'Golden Points', icon: Coins, color: 'text-amber-600 dark:text-amber-500', bg: 'bg-amber-500/10', data: gpRank },
  ];

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold tracking-tight">Skills and indicators</h3>
        {sorted.length > 0 && (
          <span className="text-[10px] text-muted-foreground tabular-nums">
            {sorted.length} skill{sorted.length === 1 ? '' : 's'}
          </span>
        )}
      </div>

      {sorted.length === 0 ? (
        <Card className="p-4 text-center">
          <p className="text-xs text-muted-foreground">No skills assigned yet.</p>
        </Card>
      ) : (
        <div className={`grid gap-2.5 ${compact ? 'grid-cols-2 md:grid-cols-3' : 'grid-cols-2 md:grid-cols-3 lg:grid-cols-6'}`}>
          {sorted.map((s) => {
            const accent = TYPE_ACCENT[s.skill_type];
            return (
              <Card
                key={s.id}
                className={`relative p-3 border-l-4 ${accent.ring} hover:shadow-md transition-shadow`}
              >
                <span className={`inline-block text-[9px] font-bold tracking-widest px-1.5 py-0.5 rounded ${accent.chip}`}>
                  {TYPE_LABEL[s.skill_type]}
                </span>
                <p className="mt-1.5 text-xs font-semibold leading-tight line-clamp-2 min-h-[2rem]">
                  {s.skill_name}
                </p>
              </Card>
            );
          })}
        </div>
      )}

      {/* Leaderboard ranks */}
      <div className="mt-4">
        <div className="flex items-center gap-1.5 mb-2">
          <Trophy className="w-3.5 h-3.5 text-amber-500" />
          <h4 className="text-xs font-semibold tracking-tight">Leaderboard Ranks</h4>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {rankItems.map(({ key, label, icon: Icon, color, bg, data }) => (
            <Card key={key} className="p-3 flex items-center gap-3 hover:shadow-md transition-shadow">
              <div className={`w-9 h-9 rounded-lg ${bg} ${color} flex items-center justify-center shrink-0`}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider truncate">{label}</p>
                <div className="flex items-baseline gap-1.5">
                  <span className={`text-lg font-bold tabular-nums ${color}`}>
                    {data.rank ? `#${data.rank}` : '—'}
                  </span>
                  <span className="text-[11px] text-muted-foreground tabular-nums">
                    · {data.points.toLocaleString()} pts
                  </span>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

