import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Trophy, Target, Zap, Coins, ChevronDown, ChevronUp } from 'lucide-react';
import type { SkillType } from '@/hooks/useMemberSkills';

interface Props {
  userId: string;
  className?: string;
  compact?: boolean;
}

const TYPE_CONFIG: Record<
  SkillType,
  { title: string; badgeBg: string; textColor: string; dotColor: string }
> = {
  primary: {
    title: 'PRIMARY',
    badgeBg: 'bg-indigo-500/10 border-indigo-500/30 text-indigo-600 dark:text-indigo-400',
    textColor: 'text-indigo-600 dark:text-indigo-400',
    dotColor: 'bg-indigo-500',
  },
  secondary: {
    title: 'SECONDARY',
    badgeBg: 'bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400',
    textColor: 'text-rose-600 dark:text-rose-400',
    dotColor: 'bg-rose-500',
  },
  specialization: {
    title: 'SPECIALIZATION',
    badgeBg: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400',
    textColor: 'text-emerald-600 dark:text-emerald-400',
    dotColor: 'bg-emerald-500',
  },
};

export function SkillsAndIndicatorsGrid({ userId, className }: Props) {
  const [isExpanded, setIsExpanded] = useState(false);

  // User skills query
  const skillsQ = useQuery({
    queryKey: ['skills-grid:user', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('member_skills')
        .select('id, skill_name, skill_type, domain, custom_domain')
        .eq('user_id', userId);
      if (error) throw error;
      return data as Array<{
        id: string;
        skill_name: string;
        skill_type: SkillType;
        domain?: string;
        custom_domain?: string;
      }>;
    },
    enabled: !!userId,
  });

  // PS score per user
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

  const computeRank = (m: Map<string, number>): { rank: number | null; points: number } => {
    const points = m.get(userId) || 0;
    if (m.size === 0) return { rank: null, points };
    const scored = Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
    let rank = 0;
    let last: number | null = null;
    for (const [uid, val] of scored) {
      if (val !== last) {
        rank += 1;
        last = val;
      }
      if (uid === userId) return { rank, points };
    }
    return { rank: scored.length + 1, points };
  };

  const psRank = useMemo(() => computeRank(psQ.data || new Map()), [psQ.data, userId]);
  const apRank = useMemo(() => computeRank(apQ.data || new Map()), [apQ.data, userId]);
  const gpRank = useMemo(() => computeRank(gpQ.data || new Map()), [gpQ.data, userId]);

  if (skillsQ.isLoading) {
    return (
      <div className={className}>
        <div className="h-32 rounded-2xl bg-muted/40 animate-pulse" />
      </div>
    );
  }

  const primarySkills = skills.filter((s) => s.skill_type === 'primary');
  const secondarySkills = skills.filter((s) => s.skill_type === 'secondary');
  const specSkills = skills.filter((s) => s.skill_type === 'specialization');

  // Categories to render based on expanded state
  const visibleCategories: Array<{ type: SkillType; list: typeof skills }> = isExpanded
    ? [
        { type: 'primary', list: primarySkills },
        { type: 'secondary', list: secondarySkills },
        { type: 'specialization', list: specSkills },
      ]
    : [
        { type: 'primary', list: primarySkills },
        { type: 'secondary', list: secondarySkills },
      ];

  const hasMoreToExpand = skills.length > 3 || specSkills.length > 0;

  const rankItems = [
    {
      key: 'ps',
      label: 'PS Score',
      icon: Target,
      color: 'text-sky-600 dark:text-sky-400',
      bg: 'bg-sky-500/10 border-sky-500/20',
      data: psRank,
    },
    {
      key: 'ap',
      label: 'Activity Points',
      icon: Zap,
      color: 'text-violet-600 dark:text-violet-400',
      bg: 'bg-violet-500/10 border-violet-500/20',
      data: apRank,
    },
    {
      key: 'gp',
      label: 'Golden Points',
      icon: Coins,
      color: 'text-amber-600 dark:text-amber-500',
      bg: 'bg-amber-500/10 border-amber-500/20',
      data: gpRank,
    },
  ];

  return (
    <div className={`space-y-4 ${className || ''}`}>
      {/* Skills & Indicators Card Container */}
      <Card className="p-4 sm:p-5 border-border/80 shadow-xs space-y-4 rounded-2xl bg-card">
        <div className="flex items-center justify-between border-b border-border/60 pb-3">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-bold tracking-tight text-foreground">Skills & Indicators</h3>
          </div>
          <Badge variant="secondary" className="text-xs px-2 py-0.5 font-bold tabular-nums">
            {skills.length} skills
          </Badge>
        </div>

        {skills.length === 0 ? (
          <div className="text-center py-4 text-xs text-muted-foreground">
            No skills assigned yet.
          </div>
        ) : (
          <div className="space-y-4 transition-all duration-300">
            {visibleCategories.map(({ type, list }) => {
              if (list.length === 0) return null;
              const cfg = TYPE_CONFIG[type];
              return (
                <div key={type} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-extrabold tracking-wider text-muted-foreground uppercase">
                      {cfg.title}
                    </span>
                    <div className="h-[1px] flex-1 bg-border/50" />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {list.map((s) => {
                      const domainName = s.custom_domain || s.domain;
                      return (
                        <div
                          key={s.id}
                          className="flex items-center justify-between p-2.5 rounded-xl border border-border/60 bg-muted/30 hover:bg-muted/50 transition-colors text-xs"
                        >
                          <span className="font-semibold text-foreground truncate">{s.skill_name}</span>
                          {domainName ? (
                            <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 border-primary/30 text-primary font-medium shrink-0 ml-2">
                              {domainName}
                            </Badge>
                          ) : (
                            <span className="w-2 h-2 rounded-full shrink-0 bg-primary/70 ml-2" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {/* Expand / Collapse Button */}
            {hasMoreToExpand && (
              <div className="pt-2 border-t border-border/50 flex justify-center">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="text-xs text-primary font-semibold hover:bg-primary/10 transition-colors gap-1 h-8 px-3"
                >
                  {isExpanded ? (
                    <>
                      Show less <ChevronUp className="w-3.5 h-3.5" />
                    </>
                  ) : (
                    <>
                      View all {skills.length} skills <ChevronDown className="w-3.5 h-3.5" />
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Leaderboard Cards */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5 px-1">
          <Trophy className="w-3.5 h-3.5 text-amber-500" />
          <h4 className="text-xs font-bold tracking-tight text-foreground uppercase">Leaderboard</h4>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {rankItems.map(({ key, label, icon: Icon, color, bg, data }) => (
            <Card key={key} className={`p-3.5 border ${bg} rounded-2xl transition-all shadow-xs`}>
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl ${bg} ${color} flex items-center justify-center shrink-0`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider truncate">
                    {label}
                  </p>
                  <div className="flex items-baseline gap-1.5 mt-0.5">
                    <span className={`text-base font-extrabold tabular-nums ${color}`}>
                      {data.rank ? `#${data.rank}` : '—'}
                    </span>
                    <span className="text-[11px] font-semibold text-muted-foreground tabular-nums">
                      · {data.points.toLocaleString()} pts
                    </span>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
