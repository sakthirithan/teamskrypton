import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
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

  // All members' skills (for rank computation across the team)
  const allSkillsQ = useQuery({
    queryKey: ['skills-grid:all-skills'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('member_skills')
        .select('user_id, skill_name');
      if (error) throw error;
      return data as Array<{ user_id: string; skill_name: string }>;
    },
  });

  // Lifetime XP per user (any session)
  const xpByUserQ = useQuery({
    queryKey: ['skills-grid:xp-by-user'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('skill_xp_log' as any)
        .select('user_id, xp_amount');
      if (error) throw error;
      const sums = new Map<string, number>();
      (data as any[]).forEach((r) => {
        sums.set(r.user_id, (sums.get(r.user_id) || 0) + (r.xp_amount || 0));
      });
      return sums;
    },
    staleTime: 60_000,
  });

  const skills = skillsQ.data || [];
  const xpByUser = xpByUserQ.data || new Map<string, number>();
  const myXp = xpByUser.get(userId) || 0;

  /** rank for (this user, this skill_name) — dense rank among all users that share it */
  const rankFor = useMemo(() => {
    const fn = (skillName: string): number | null => {
      const peers = (allSkillsQ.data || []).filter((r) => r.skill_name === skillName);
      if (peers.length === 0) return null;
      const peerIds = Array.from(new Set(peers.map((p) => p.user_id)));
      const scored = peerIds
        .map((uid) => ({ uid, xp: xpByUser.get(uid) || 0 }))
        .sort((a, b) => b.xp - a.xp);
      // dense rank
      let rank = 0;
      let lastXp: number | null = null;
      for (const s of scored) {
        if (s.xp !== lastXp) {
          rank += 1;
          lastXp = s.xp;
        }
        if (s.uid === userId) return rank;
      }
      return null;
    };
    return fn;
  }, [allSkillsQ.data, xpByUser, userId]);

  if (skillsQ.isLoading) {
    return <div className={className}><div className="h-20 rounded-xl bg-muted/40 animate-pulse" /></div>;
  }
  if (skills.length === 0) {
    return (
      <div className={className}>
        <Card className="p-4 text-center">
          <p className="text-xs text-muted-foreground">No skills assigned yet.</p>
        </Card>
      </div>
    );
  }

  // Sort: primary → specialization → secondary, alphabetical inside (matches image-4 grouping vibe)
  const order: SkillType[] = ['primary', 'secondary', 'specialization'];
  const sorted = [...skills].sort((a, b) => {
    const o = order.indexOf(a.skill_type) - order.indexOf(b.skill_type);
    return o !== 0 ? o : a.skill_name.localeCompare(b.skill_name);
  });

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold tracking-tight">Skills and indicators</h3>
        <span className="text-[10px] text-muted-foreground tabular-nums">
          {sorted.length} skill{sorted.length === 1 ? '' : 's'}
        </span>
      </div>
      <div className={`grid gap-2.5 ${compact ? 'grid-cols-2 md:grid-cols-3' : 'grid-cols-2 md:grid-cols-3 lg:grid-cols-6'}`}>
        {sorted.map((s) => {
          const accent = TYPE_ACCENT[s.skill_type];
          const rank = rankFor(s.skill_name);
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
              <p className={`mt-1 text-2xl font-bold tabular-nums ${accent.text}`}>{myXp}</p>
              <p className="text-[10px] text-muted-foreground tabular-nums">
                {rank ? `Rank #${rank}` : 'Unranked'}
              </p>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
