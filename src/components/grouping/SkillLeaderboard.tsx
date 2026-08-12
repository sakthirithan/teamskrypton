import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Trophy, Medal, Crown, Zap, TrendingUp, Users, Flame } from 'lucide-react';
import { useSkillLevels, LEVEL_NAMES, LEVEL_COLORS, getXpProgress, SkillLevel } from '@/hooks/useSkillLevels';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { VISIBLE_PROFILE_OR } from '@/lib/profileVisibility';

interface SkillLeaderboardProps {
  sessionId: string;
}

export function SkillLeaderboard({ sessionId }: SkillLeaderboardProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { leaderboard } = useSkillLevels(sessionId);

  const { data: profiles = [] } = useQuery({
    queryKey: ['profiles-for-leaderboard'],
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('user_id, full_name').or(VISIBLE_PROFILE_OR)
        .eq('is_test', false);
      return data || [];
    },
  });

  const { data: streaks = [] } = useQuery({
    queryKey: ['all-streaks-leaderboard', sessionId],
    queryFn: async () => {
      const { data } = await supabase
        .from('skill_streaks' as any)
        .select('*')
        .eq('session_id', sessionId);
      return (data || []) as any[];
    },
    enabled: !!sessionId,
  });

  const rankedMembers = useMemo(() => {
    const profileMap = new Map(profiles.map(p => [p.user_id, p.full_name]));
    const streakMap = new Map(streaks.map((s: any) => [s.user_id, s.current_streak]));

    return leaderboard
      .map((entry, idx) => ({
        ...entry,
        rank: idx + 1,
        name: profileMap.get(entry.user_id) || 'Unknown',
        streak: streakMap.get(entry.user_id) || 0,
        isCurrentUser: entry.user_id === user?.id,
      }))
      .sort((a, b) => b.xp - a.xp);
  }, [leaderboard, profiles, streaks, user]);

  // Stats
  const totalXp = rankedMembers.reduce((sum, m) => sum + m.xp, 0);
  const avgLevel = rankedMembers.length > 0 
    ? (rankedMembers.reduce((sum, m) => sum + m.level, 0) / rankedMembers.length).toFixed(1)
    : '0';
  const currentUserRank = rankedMembers.find(m => m.isCurrentUser)?.rank || '-';

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1: return <Crown className="w-4 h-4 text-amber-500" />;
      case 2: return <Medal className="w-4 h-4 text-slate-400" />;
      case 3: return <Medal className="w-4 h-4 text-amber-700" />;
      default: return <span className="text-xs font-bold text-muted-foreground w-4 text-center">{rank}</span>;
    }
  };

  const getRankBg = (rank: number, isCurrentUser: boolean) => {
    if (isCurrentUser) return 'bg-primary/5 border-primary/20';
    switch (rank) {
      case 1: return 'bg-amber-500/5 border-amber-500/20';
      case 2: return 'bg-slate-500/5 border-slate-500/15';
      case 3: return 'bg-amber-700/5 border-amber-700/15';
      default: return 'border-transparent hover:bg-muted/50';
    }
  };

  return (
    <div className="space-y-3">
      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-3 text-center">
            <Trophy className="w-5 h-5 mx-auto mb-1 text-amber-500" />
            <p className="text-xl font-bold">{currentUserRank}</p>
            <p className="text-[10px] text-muted-foreground">Your Rank</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <TrendingUp className="w-5 h-5 mx-auto mb-1 text-primary" />
            <p className="text-xl font-bold">{avgLevel}</p>
            <p className="text-[10px] text-muted-foreground">Avg Level</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <Zap className="w-5 h-5 mx-auto mb-1 text-emerald-500" />
            <p className="text-xl font-bold">{totalXp.toLocaleString()}</p>
            <p className="text-[10px] text-muted-foreground">Total XP</p>
          </CardContent>
        </Card>
      </div>

      {/* Leaderboard */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-500" />
            Skill Leaderboard
            <Badge variant="secondary" className="ml-auto text-xs tabular-nums">
              {rankedMembers.length} members
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {rankedMembers.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p>No XP earned yet this session.</p>
              <p className="text-xs mt-1">Complete learning activities to earn XP!</p>
            </div>
          ) : (
            <ScrollArea className="h-[400px]">
              <div className="divide-y">
                {rankedMembers.map((member) => {
                  const progress = getXpProgress(member.xp, member.level);
                  return (
                    <div
                      key={member.user_id}
                      className={`flex items-center gap-3 px-4 py-3 border transition-colors cursor-pointer ${getRankBg(member.rank, member.isCurrentUser)}`}
                      onClick={() => navigate(`/grouping/me?userId=${member.user_id}`)}
                    >
                      {/* Rank */}
                      <div className="w-6 flex justify-center shrink-0">
                        {getRankIcon(member.rank)}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium truncate">
                            {member.name}
                            {member.isCurrentUser && (
                              <span className="text-xs text-primary ml-1">(You)</span>
                            )}
                          </p>
                          {member.streak > 0 && (
                            <Badge variant="outline" className="text-[9px] px-1 py-0 gap-0.5 border-amber-500/30 text-amber-600">
                              <Flame className="w-2.5 h-2.5" />
                              {member.streak}w
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className={`text-[9px] px-1.5 py-0 ${LEVEL_COLORS[member.level - 1]}`}>
                            Lv.{member.level} {LEVEL_NAMES[member.level - 1]}
                          </Badge>
                          <div className="flex-1 max-w-[80px]">
                            <Progress value={progress} className="h-1" />
                          </div>
                        </div>
                      </div>

                      {/* XP */}
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold tabular-nums">{member.xp.toLocaleString()}</p>
                        <p className="text-[9px] text-muted-foreground">XP</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
