import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Trophy, Crown, Medal, Zap, Star, Target, Plus, Flame } from 'lucide-react';
import { useSkillLevels, LEVEL_NAMES, LEVEL_COLORS, getXpProgress } from '@/hooks/useSkillLevels';
import { useActivityPoints } from '@/hooks/useActivityPoints';
import { useGroupingSessions } from '@/hooks/useGroupingSessions';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Progress } from '@/components/ui/progress';
import { useNavigate } from 'react-router-dom';

export function LeaderboardPanel() {
  const { user, isLeadership } = useAuth();
  const navigate = useNavigate();
  const { sessions } = useGroupingSessions();
  const activeSession = sessions.find(s => s.status === 'active');
  const sessionId = activeSession?.id || '';

  const { leaderboard: xpLeaderboard } = useSkillLevels(sessionId);
  const { getLeaderboard: getActivityLeaderboard, awardPoints, activityPoints } = useActivityPoints(sessionId);

  const { data: profiles = [] } = useQuery({
    queryKey: ['profiles-leaderboard-all'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('user_id, full_name').eq('is_test', false);
      return data || [];
    },
  });

  const { data: psEntries = [] } = useQuery({
    queryKey: ['ps-leaderboard', sessionId],
    queryFn: async () => {
      if (!sessionId) return [];
      const { data } = await supabase
        .from('ps_daily_entries')
        .select('user_id, reward_points')
        .eq('session_id', sessionId)
        .eq('status', 'completed');
      return data || [];
    },
    enabled: !!sessionId,
  });

  const { data: streaks = [] } = useQuery({
    queryKey: ['streaks-leaderboard', sessionId],
    queryFn: async () => {
      if (!sessionId) return [];
      const { data } = await supabase.from('skill_streaks').select('*').eq('session_id', sessionId);
      return (data || []) as any[];
    },
    enabled: !!sessionId,
  });

  const { data: memberSkills = [] } = useQuery({
    queryKey: ['member-skills-leaderboard'],
    queryFn: async () => {
      const { data } = await supabase.from('member_skills').select('user_id, skill_name');
      return data || [];
    },
  });

  const { data: challengeCompletions = [] } = useQuery({
    queryKey: ['challenge-completions-lb', sessionId],
    queryFn: async () => {
      if (!sessionId) return [];
      const { data } = await supabase
        .from('skill_challenge_completions')
        .select('user_id, challenge_id, status')
        .eq('status', 'approved');
      return data || [];
    },
    enabled: !!sessionId,
  });

  const { data: challenges = [] } = useQuery({
    queryKey: ['challenges-lb', sessionId],
    queryFn: async () => {
      if (!sessionId) return [];
      const { data } = await supabase
        .from('skill_challenges')
        .select('id, title, xp_reward, session_id')
        .eq('session_id', sessionId);
      return data || [];
    },
    enabled: !!sessionId,
  });

  const profileMap = useMemo(() => new Map(profiles.map(p => [p.user_id, p.full_name])), [profiles]);
  const streakMap = useMemo(() => new Map(streaks.map((s: any) => [s.user_id, s.current_streak])), [streaks]);

  // XP Rank
  const xpRanked = useMemo(() =>
    xpLeaderboard.map((e, i) => ({
      ...e, rank: i + 1, name: profileMap.get(e.user_id) || 'Unknown',
      isMe: e.user_id === user?.id, streak: streakMap.get(e.user_id) || 0,
    })),
  [xpLeaderboard, profileMap, user, streakMap]);

  // PS Points Rank
  const psRanked = useMemo(() => {
    const totals = new Map<string, number>();
    psEntries.forEach((e: any) => totals.set(e.user_id, (totals.get(e.user_id) || 0) + e.reward_points));
    return Array.from(totals.entries())
      .map(([uid, pts]) => ({ user_id: uid, points: pts, name: profileMap.get(uid) || 'Unknown', isMe: uid === user?.id }))
      .sort((a, b) => b.points - a.points)
      .map((e, i) => ({ ...e, rank: i + 1 }));
  }, [psEntries, profileMap, user]);

  // Activity Rank
  const activityRanked = useMemo(() => {
    const lb = getActivityLeaderboard();
    return lb.map((e, i) => ({
      ...e, rank: i + 1, name: profileMap.get(e.user_id) || 'Unknown', isMe: e.user_id === user?.id,
    }));
  }, [getActivityLeaderboard, profileMap, user]);

  // Skill-wise rank (group by skill, rank by challenge XP earned)
  const skillWiseRanked = useMemo(() => {
    const skillUsers = new Map<string, Map<string, number>>();
    challengeCompletions.forEach((cc: any) => {
      const ch = challenges.find((c: any) => c.id === cc.challenge_id);
      if (!ch) return;
      // Get user's skills
      const userSkills = memberSkills.filter((ms: any) => ms.user_id === cc.user_id);
      userSkills.forEach((ms: any) => {
        if (!skillUsers.has(ms.skill_name)) skillUsers.set(ms.skill_name, new Map());
        const map = skillUsers.get(ms.skill_name)!;
        map.set(cc.user_id, (map.get(cc.user_id) || 0) + ch.xp_reward);
      });
    });
    const result: Record<string, { user_id: string; xp: number; name: string; rank: number; isMe: boolean }[]> = {};
    skillUsers.forEach((userMap, skillName) => {
      result[skillName] = Array.from(userMap.entries())
        .map(([uid, xp]) => ({ user_id: uid, xp, name: profileMap.get(uid) || 'Unknown', isMe: uid === user?.id, rank: 0 }))
        .sort((a, b) => b.xp - a.xp)
        .map((e, i) => ({ ...e, rank: i + 1 }));
    });
    return result;
  }, [challengeCompletions, challenges, memberSkills, profileMap, user]);

  const [selectedSkill, setSelectedSkill] = useState<string>('');
  const skillNames = Object.keys(skillWiseRanked);

  // Award dialog state
  const [awardOpen, setAwardOpen] = useState(false);
  const [awardUserId, setAwardUserId] = useState('');
  const [awardPts, setAwardPts] = useState('');
  const [awardReason, setAwardReason] = useState('');

  const handleAward = () => {
    if (!awardUserId || !awardPts || !sessionId) return;
    awardPoints.mutate({
      userId: awardUserId,
      points: parseInt(awardPts),
      reason: awardReason,
      sessionId,
    }, {
      onSuccess: () => { setAwardOpen(false); setAwardPts(''); setAwardReason(''); setAwardUserId(''); }
    });
  };

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1: return <Crown className="w-4 h-4 text-amber-500" />;
      case 2: return <Medal className="w-4 h-4 text-slate-400" />;
      case 3: return <Medal className="w-4 h-4 text-amber-700" />;
      default: return <span className="text-xs font-bold text-muted-foreground w-4 text-center">{rank}</span>;
    }
  };

  const getRankBg = (rank: number, isMe: boolean) => {
    if (isMe) return 'bg-primary/5 border-primary/20';
    if (rank === 1) return 'bg-amber-500/5 border-amber-500/20';
    if (rank === 2) return 'bg-slate-500/5 border-slate-500/15';
    if (rank === 3) return 'bg-amber-700/5 border-amber-700/15';
    return 'border-transparent hover:bg-muted/50';
  };

  const renderRankRow = (entry: { rank: number; name: string; isMe: boolean; user_id: string }, valueLabel: string, value: string | number) => (
    <div
      key={entry.user_id}
      className={`flex items-center gap-3 px-4 py-3 border transition-colors cursor-pointer ${getRankBg(entry.rank, entry.isMe)}`}
      onClick={() => navigate(`/grouping/me?userId=${entry.user_id}`)}
    >
      <div className="w-6 flex justify-center shrink-0">{getRankIcon(entry.rank)}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">
          {entry.name}
          {entry.isMe && <span className="text-xs text-primary ml-1">(You)</span>}
        </p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-sm font-bold tabular-nums">{typeof value === 'number' ? value.toLocaleString() : value}</p>
        <p className="text-[9px] text-muted-foreground">{valueLabel}</p>
      </div>
    </div>
  );

  const emptyState = (msg: string) => (
    <div className="py-12 text-center text-sm text-muted-foreground">
      <Trophy className="w-8 h-8 mx-auto mb-2 opacity-30" />
      <p>{msg}</p>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Trophy className="w-5 h-5 text-amber-500" />
          Leaderboard
        </h1>
        {isLeadership && (
          <Dialog open={awardOpen} onOpenChange={setAwardOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1"><Plus className="w-3 h-3" /> Award Activity Points</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Award Activity Points</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <Select value={awardUserId} onValueChange={setAwardUserId}>
                  <SelectTrigger><SelectValue placeholder="Select member" /></SelectTrigger>
                  <SelectContent>
                    {profiles.map(p => (
                      <SelectItem key={p.user_id} value={p.user_id}>{p.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input type="number" placeholder="Points" value={awardPts} onChange={e => setAwardPts(e.target.value)} />
                <Textarea placeholder="Reason (optional)" value={awardReason} onChange={e => setAwardReason(e.target.value)} />
                <Button onClick={handleAward} disabled={!awardUserId || !awardPts} className="w-full">
                  Award Points
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {!activeSession && (
        <Card><CardContent className="p-4 text-center text-muted-foreground text-sm">No active session. Leaderboard data requires an active session.</CardContent></Card>
      )}

      <Tabs defaultValue="xp" className="w-full">
        <TabsList className="w-full grid grid-cols-4">
          <TabsTrigger value="xp" className="text-xs gap-1"><Zap className="w-3 h-3" /> XP Rank</TabsTrigger>
          <TabsTrigger value="ps" className="text-xs gap-1"><Target className="w-3 h-3" /> PS Points</TabsTrigger>
          <TabsTrigger value="activity" className="text-xs gap-1"><Star className="w-3 h-3" /> Activity</TabsTrigger>
          <TabsTrigger value="skill" className="text-xs gap-1"><Flame className="w-3 h-3" /> Skill-wise</TabsTrigger>
        </TabsList>

        {/* XP Rank */}
        <TabsContent value="xp">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Zap className="w-4 h-4 text-primary" /> XP Leaderboard
                <Badge variant="secondary" className="ml-auto text-xs">{xpRanked.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {xpRanked.length === 0 ? emptyState('No XP earned yet.') : (
                <ScrollArea className="h-[450px]">
                  <div className="divide-y">
                    {xpRanked.map(m => (
                      <div
                        key={m.user_id}
                        className={`flex items-center gap-3 px-4 py-3 border transition-colors cursor-pointer ${getRankBg(m.rank, m.isMe)}`}
                        onClick={() => navigate(`/grouping/me?userId=${m.user_id}`)}
                      >
                        <div className="w-6 flex justify-center shrink-0">{getRankIcon(m.rank)}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium truncate">
                              {m.name}{m.isMe && <span className="text-xs text-primary ml-1">(You)</span>}
                            </p>
                            {m.streak > 0 && (
                              <Badge variant="outline" className="text-[9px] px-1 py-0 gap-0.5 border-amber-500/30 text-amber-600">
                                <Flame className="w-2.5 h-2.5" />{m.streak}w
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className={`text-[9px] px-1.5 py-0 ${LEVEL_COLORS[m.level - 1]}`}>
                              Lv.{m.level} {LEVEL_NAMES[m.level - 1]}
                            </Badge>
                            <div className="flex-1 max-w-[80px]">
                              <Progress value={getXpProgress(m.xp, m.level)} className="h-1" />
                            </div>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-bold tabular-nums">{m.xp.toLocaleString()}</p>
                          <p className="text-[9px] text-muted-foreground">XP</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* PS Points Rank */}
        <TabsContent value="ps">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Target className="w-4 h-4 text-emerald-500" /> PS Points Leaderboard
                <Badge variant="secondary" className="ml-auto text-xs">{psRanked.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {psRanked.length === 0 ? emptyState('No PS points earned yet.') : (
                <ScrollArea className="h-[450px]">
                  <div className="divide-y">
                    {psRanked.map(e => renderRankRow(e, 'Points', e.points))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Activity Rank */}
        <TabsContent value="activity">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Star className="w-4 h-4 text-amber-500" /> Activity Points Leaderboard
                <Badge variant="secondary" className="ml-auto text-xs">{activityRanked.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {activityRanked.length === 0 ? emptyState('No activity points awarded yet.') : (
                <ScrollArea className="h-[450px]">
                  <div className="divide-y">
                    {activityRanked.map(e => renderRankRow(e, 'Points', e.points))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Skill-wise Rank */}
        <TabsContent value="skill">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Flame className="w-4 h-4 text-orange-500" /> Skill-wise Challenge Rank
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {skillNames.length === 0 ? emptyState('No skill challenge completions yet.') : (
                <>
                  <Select value={selectedSkill || skillNames[0]} onValueChange={setSelectedSkill}>
                    <SelectTrigger><SelectValue placeholder="Select skill" /></SelectTrigger>
                    <SelectContent>
                      {skillNames.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <ScrollArea className="h-[400px]">
                    <div className="divide-y">
                      {(skillWiseRanked[selectedSkill || skillNames[0]] || []).map(e =>
                        renderRankRow(e, 'XP', e.xp)
                      )}
                    </div>
                  </ScrollArea>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
