import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Trophy, Crown, Medal, Flame, Zap } from 'lucide-react';
import { useSkillLevels, LEVEL_NAMES, LEVEL_COLORS, getXpProgress } from '@/hooks/useSkillLevels';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { useMemo } from 'react';

interface TeamSkillLeaderboardProps {
  sessionId: string;
  limit?: number;
}

export function TeamSkillLeaderboard({ sessionId, limit = 10 }: TeamSkillLeaderboardProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { leaderboard } = useSkillLevels(sessionId);

  const { data: profiles = [] } = useQuery({
    queryKey: ['profiles-leaderboard-team'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('user_id, full_name').eq('is_test', false);
      return data || [];
    },
  });

  const ranked = useMemo(() => {
    const profileMap = new Map(profiles.map(p => [p.user_id, p.full_name]));
    return leaderboard
      .map((entry, idx) => ({
        ...entry,
        rank: idx + 1,
        name: profileMap.get(entry.user_id) || 'Unknown',
        isMe: entry.user_id === user?.id,
      }))
      .slice(0, limit);
  }, [leaderboard, profiles, user, limit]);

  if (ranked.length === 0) return null;

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1: return <Crown className="w-4 h-4 text-amber-500" />;
      case 2: return <Medal className="w-4 h-4 text-slate-400" />;
      case 3: return <Medal className="w-4 h-4 text-amber-700" />;
      default: return <span className="text-[10px] font-bold text-muted-foreground w-4 text-center">{rank}</span>;
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Trophy className="w-4 h-4 text-amber-500" />
          Skill Leaderboard
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y">
          {ranked.map(m => (
            <div
              key={m.user_id}
              className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors hover:bg-muted/50 ${m.isMe ? 'bg-primary/5' : ''}`}
              onClick={() => navigate(`/grouping/me?userId=${m.user_id}`)}
            >
              <div className="w-5 flex justify-center">{getRankIcon(m.rank)}</div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">
                  {m.name} {m.isMe && <span className="text-primary">(You)</span>}
                </p>
                <Badge variant="outline" className={`text-[9px] px-1 py-0 ${LEVEL_COLORS[m.level - 1]}`}>
                  Lv.{m.level} {LEVEL_NAMES[m.level - 1]}
                </Badge>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs font-bold tabular-nums">{m.xp.toLocaleString()}</p>
                <p className="text-[9px] text-muted-foreground">XP</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
