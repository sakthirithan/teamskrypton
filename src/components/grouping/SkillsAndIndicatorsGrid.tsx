import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Trophy, Target, Zap, Coins } from 'lucide-react';

interface Props {
  userId: string;
  className?: string;
}

export function OverviewLeaderboard({ userId, className }: Props) {
  // Fetch active session IDs first so PS scores only reflect current sessions
  const activeSessionsQ = useQuery({
    queryKey: ['grouping-sessions', 'active-ids'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('grouping_sessions')
        .select('id')
        .eq('status', 'active');
      if (error) throw error;
      return (data || []).map((s: any) => s.id) as string[];
    },
    staleTime: 60_000,
  });

  // PS score per user — only completed entries within active sessions
  const psQ = useQuery({
    queryKey: ['ps-daily-entries', 'leaderboard', activeSessionsQ.data],
    queryFn: async () => {
      const sessionIds = activeSessionsQ.data;
      if (!sessionIds || sessionIds.length === 0) return new Map<string, number>();
      const { data, error } = await supabase
        .from('ps_daily_entries')
        .select('user_id, reward_points, session_id')
        .eq('status', 'completed')
        .in('session_id', sessionIds);
      if (error) throw error;
      const m = new Map<string, number>();
      (data || []).forEach((r: any) => m.set(r.user_id, (m.get(r.user_id) || 0) + (r.reward_points || 0)));
      return m;
    },
    enabled: !!activeSessionsQ.data,
    staleTime: 30_000,
  });


  // Activity points per user
  const apQ = useQuery({
    queryKey: ['activity-points', 'leaderboard'],
    queryFn: async () => {
      const { data, error } = await supabase.from('activity_points').select('user_id, points');
      if (error) throw error;
      const m = new Map<string, number>();
      (data || []).forEach((r: any) => m.set(r.user_id, (m.get(r.user_id) || 0) + (r.points || 0)));
      return m;
    },
    staleTime: 30_000,
  });

  // Golden points per user
  const gpQ = useQuery({
    queryKey: ['user-points', 'leaderboard'],
    queryFn: async () => {
      const { data, error } = await supabase.from('user_points').select('user_id, points');
      if (error) throw error;
      const m = new Map<string, number>();
      (data || []).forEach((r: any) => m.set(r.user_id, r.points || 0));
      return m;
    },
    staleTime: 30_000,
  });

  const computeRank = (m: Map<string, number>): { rank: number | null; points: number } => {
    const points = m.get(userId) || 0;
    
    const hasAnyPoints = Array.from(m.values()).some(p => p > 0);
    if (!hasAnyPoints) {
      return { rank: null, points };
    }
    
    let usersAhead = 0;
    for (const [uid, val] of m.entries()) {
      if (uid !== userId && val > points) {
        usersAhead++;
      }
    }
    
    return { rank: usersAhead + 1, points };
  };

  const psRank = useMemo(() => computeRank(psQ.data || new Map()), [psQ.data, userId]);
  const apRank = useMemo(() => computeRank(apQ.data || new Map()), [apQ.data, userId]);
  const gpRank = useMemo(() => computeRank(gpQ.data || new Map()), [gpQ.data, userId]);

  if (activeSessionsQ.isLoading || psQ.isLoading || apQ.isLoading || gpQ.isLoading) {
    return (
      <div className={`grid grid-cols-1 sm:grid-cols-3 gap-3 ${className || ''}`}>
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 rounded-2xl bg-muted/40 animate-pulse border border-border/50" />
        ))}
      </div>
    );
  }

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
    <div className={`space-y-3 ${className || ''}`}>
      <div className="flex items-center gap-1.5 px-1 pb-1">
        <Trophy className="w-4 h-4 text-amber-500" />
        <h4 className="text-sm font-bold tracking-tight text-foreground">Leaderboard & Performance</h4>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {rankItems.map(({ key, label, icon: Icon, color, bg, data }) => (
          <Card key={key} className={`p-4 border ${bg} rounded-2xl transition-all shadow-xs`}>
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
  );
}
