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
import { Trophy, Crown, Medal, Zap, Star, Target, Plus, Flame, Coins } from 'lucide-react';
import { useSkillLevels, LEVEL_NAMES, LEVEL_COLORS, getXpProgress } from '@/hooks/useSkillLevels';
import { useActivityPoints } from '@/hooks/useActivityPoints';
import { useGroupingSessions } from '@/hooks/useGroupingSessions';
import { useGroupingTargets } from '@/hooks/useGroupingTargets';
import { useAuth } from '@/hooks/useAuth';
import { useUserPoints } from '@/hooks/useUserPoints';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Progress } from '@/components/ui/progress';
import { useNavigate } from 'react-router-dom';
import { VISIBLE_PROFILE_OR } from '@/lib/profileVisibility';

export function usePblProjectLead(userId?: string) {
  return useQuery({
    queryKey: ['user-pbl-lead', userId],
    queryFn: async () => {
      if (!userId) return false;
      const { data } = await supabase
        .from('project_members')
        .select('project_id')
        .eq('user_id', userId)
        .eq('role', 'lead')
        .limit(1);
      return data && data.length > 0;
    },
    enabled: !!userId,
  });
}

export function LeaderboardPanel() {
  const { user, isLeadership } = useAuth();
  const navigate = useNavigate();
  const { data: isProjectLead } = usePblProjectLead(user?.id);
  const canManagePoints = isLeadership || isProjectLead;
  const { sessions } = useGroupingSessions();
  const activeSession = sessions.find(s => s.status === 'active');
  const sessionId = activeSession?.id || '';

  const { leaderboard: xpLeaderboard } = useSkillLevels(sessionId);
  const { getLeaderboard: getActivityLeaderboard, awardPoints, activityPoints } = useActivityPoints(sessionId);
  const { targets } = useGroupingTargets(sessionId);
  const { allPoints } = useUserPoints();

  const { data: profiles = [] } = useQuery({
    queryKey: ['profiles-leaderboard-all'],
    queryFn: async () => {
      const nowIso = new Date().toISOString();
      const { data } = await supabase
        .from('profiles')
        .select('user_id, full_name, is_disabled, disabled_until').or(VISIBLE_PROFILE_OR)
        .eq('is_test', false)
        .or(`is_disabled.is.false,is_disabled.is.null,disabled_until.lt.${nowIso}`);
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

  // Unified ranking logic that includes all users
  const xpRanked = useMemo(() => {
    const xpMap = new Map(xpLeaderboard.map(e => [e.user_id, e]));
    return profiles
      .map(p => {
        const entry = xpMap.get(p.user_id);
        return {
          user_id: p.user_id,
          name: p.full_name,
          xp: entry?.xp || 0,
          level: entry?.level || 1,
          streak: streakMap.get(p.user_id) || 0,
          isMe: p.user_id === user?.id
        };
      })
      .sort((a, b) => b.xp - a.xp || a.name.localeCompare(b.name))
      .map((e, i) => ({ ...e, rank: i + 1 }));
  }, [profiles, xpLeaderboard, user, streakMap]);

  const psRanked = useMemo(() => {
    const totals = new Map<string, number>();
    
    // Add balance points
    targets.forEach((t) => {
      if (t.target_scope === 'individual' && t.user_id) {
        totals.set(t.user_id, (totals.get(t.user_id) || 0) + (t.balance_points || 0));
      }
    });

    // Add session earned points
    psEntries.forEach((e: any) => totals.set(e.user_id, (totals.get(e.user_id) || 0) + e.reward_points));
    
    return profiles
      .map(p => ({
        user_id: p.user_id,
        name: p.full_name,
        points: totals.get(p.user_id) || 0,
        isMe: p.user_id === user?.id
      }))
      .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name))
      .map((e, i) => ({ ...e, rank: i + 1 }));
  }, [profiles, psEntries, targets, user]);

  const pointsRanked = useMemo(() => {
    const pointsMap = new Map(allPoints.map(p => [p.user_id, p.points]));
    return profiles
      .map(p => ({
        user_id: p.user_id,
        name: p.full_name,
        points: pointsMap.get(p.user_id) || 0,
        isMe: p.user_id === user?.id
      }))
      .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name))
      .map((e, i) => ({ ...e, rank: i + 1 }));
  }, [profiles, allPoints, user]);

  const activityRanked = useMemo(() => {
    const lb = getActivityLeaderboard();
    const actMap = new Map(lb.map(e => [e.user_id, e.points]));
    return profiles
      .map(p => ({
        user_id: p.user_id,
        name: p.full_name,
        points: actMap.get(p.user_id) || 0,
        isMe: p.user_id === user?.id
      }))
      .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name))
      .map((e, i) => ({ ...e, rank: i + 1 }));
  }, [profiles, getActivityLeaderboard, user]);

  const activityPointsMap = useMemo(() => {
    const map = new Map<string, number>();
    activityRanked.forEach((e) => map.set(e.user_id, e.points));
    return map;
  }, [activityRanked]);

  const availableSkills = useMemo(() => {
    return Array.from(new Set(memberSkills.map(ms => ms.skill_name))).sort();
  }, [memberSkills]);

  const skillWiseRanked = useMemo(() => {
    const result: Record<string, { user_id: string; xp: number; name: string; rank: number; isMe: boolean }[]> = {};
    
    availableSkills.forEach(skillName => {
      const usersWithSkill = memberSkills
        .filter(ms => ms.skill_name === skillName)
        .map(ms => ms.user_id);
      
      const skillRankings = usersWithSkill.map(uid => {
        const userXp = challengeCompletions
          .filter((cc: any) => cc.user_id === uid)
          .reduce((sum, cc) => {
            const ch = challenges.find((c: any) => c.id === cc.challenge_id);
            return sum + (ch?.xp_reward || 0);
          }, 0);
        
        return {
          user_id: uid,
          xp: userXp,
          name: profileMap.get(uid) || 'Unknown',
          isMe: uid === user?.id,
          rank: 0
        };
      });

      result[skillName] = skillRankings
        .sort((a, b) => b.xp - a.xp || a.name.localeCompare(b.name))
        .map((e, i) => ({ ...e, rank: i + 1 }));
    });
    
    return result;
  }, [availableSkills, challengeCompletions, challenges, memberSkills, profileMap, user]);

  const [selectedSkill, setSelectedSkill] = useState<string>('');
  const currentSkill = selectedSkill || availableSkills[0] || '';

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1: return <Crown className="w-4 h-4 text-amber-500" />;
      case 2: return <Medal className="w-4 h-4 text-slate-400" />;
      case 3: return <Medal className="w-4 h-4 text-amber-700" />;
      default: return <span className="text-xs font-bold text-muted-foreground w-4 text-center">{rank}</span>;
    }
  };

  const renderRankRow = (entry: { rank: number; name: string; isMe: boolean; user_id: string }, valueLabel: string, value: string | number, icon?: React.ReactNode) => (
    <div
      key={entry.user_id}
      className={`group flex items-center gap-4 px-5 py-3 border-b border-border/40 last:border-0 transition-colors cursor-pointer ${
        entry.isMe ? 'bg-indigo-50/30' : 'hover:bg-muted/30'
      }`}
      onClick={() => navigate(`/grouping/me?userId=${entry.user_id}`)}
    >
      <div className="w-8 flex justify-center shrink-0 items-center">
        {getRankIcon(entry.rank)}
      </div>
      
      <div className="shrink-0 relative">
        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold border ${
          entry.isMe ? 'bg-indigo-600 text-white border-indigo-200 shadow-sm' : 'bg-muted text-muted-foreground border-border'
        }`}>
          {entry.name.charAt(0).toUpperCase()}
        </div>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <p className={`text-[13px] font-bold truncate ${entry.isMe ? 'text-indigo-900' : 'text-slate-900'}`}>
            {entry.name.toUpperCase()}
          </p>
          {entry.isMe && (
            <Badge variant="secondary" className="text-[8px] px-1.5 py-0 h-3.5 bg-indigo-100 text-indigo-700 border-none font-bold uppercase tracking-wider">
              YOU
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1.5">
           <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1 uppercase tracking-wider">
             @ {valueLabel}
           </span>
        </div>
      </div>

      <div className="text-right shrink-0">
        <div className="flex flex-col items-end leading-tight">
          <span className={`text-[15px] font-black tabular-nums ${
            entry.rank === 1 ? 'text-amber-600' : entry.isMe ? 'text-indigo-600' : 'text-slate-800'
          }`}>
            {typeof value === 'number' ? value.toLocaleString() : value}
          </span>
          <span className="text-[7px] font-black uppercase tracking-widest text-slate-300 mt-0.5 leading-none">{valueLabel}</span>
        </div>
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
    <div className="space-y-6 pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border bg-card">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-500" />
            Performance Leaderboard
          </h1>
          <p className="text-muted-foreground text-xs mt-0.5 font-medium">Competition & Skills Tracking</p>
        </div>
        
        {canManagePoints && (
          <Button 
            variant="default"
            size="sm" 
            className="gap-2 h-9 px-4 rounded-lg font-semibold" 
            onClick={() => navigate('/grouping/management/points')}
          >
            <Plus className="w-4 h-4" /> Point Management
          </Button>
        )}
      </div>

      {!activeSession && (
        <div className="bg-amber-50/50 border border-amber-100 rounded-lg p-3 flex items-center gap-3">
          <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
          <p className="text-amber-800 text-[11px] font-medium uppercase tracking-tight">Waiting for active session</p>
        </div>
      )}

      <Tabs defaultValue="xp" className="w-full">
        <TabsList className="w-full h-auto p-1 bg-muted/40 rounded-xl border border-border/50 grid grid-cols-2 lg:grid-cols-5 gap-1 mb-6">
          <TabsTrigger value="xp" className="py-1.5 rounded-lg text-xs font-semibold gap-2">
            <Zap className="w-3.5 h-3.5" /> XP
          </TabsTrigger>
          <TabsTrigger value="ps" className="py-1.5 rounded-lg text-xs font-semibold gap-2">
            <Target className="w-3.5 h-3.5" /> PS Score
          </TabsTrigger>
          <TabsTrigger value="activity" className="py-1.5 rounded-lg text-xs font-semibold gap-2">
            <Star className="w-3.5 h-3.5" /> Activity
          </TabsTrigger>
          <TabsTrigger value="golden" className="py-1.5 rounded-lg text-xs font-semibold gap-2">
            <Coins className="w-3.5 h-3.5" /> Golden
          </TabsTrigger>
          <TabsTrigger value="skill" className="py-1.5 rounded-lg text-xs font-semibold gap-2">
            <Flame className="w-3.5 h-3.5" /> Skills
          </TabsTrigger>
        </TabsList>

        {/* XP Rank */}
        <TabsContent value="xp" className="mt-0 focus-visible:outline-none">
          <Card className="rounded-xl border-border/50 shadow-sm overflow-hidden">
            <CardHeader className="py-3 px-5 bg-muted/20 border-b border-border/50">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Zap className="w-4 h-4 text-primary" /> Overall Mastery
                </CardTitle>
                <Badge variant="outline" className="text-[10px] font-medium px-2 rounded-full border-primary/20 text-primary">
                  {xpRanked.length} Members
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {xpRanked.length === 0 ? emptyState('No data available.') : (
                <ScrollArea className="h-[480px]">
                  <div className="divide-y divide-border/30">
                    {xpRanked.map(m => (
                      <div
                        key={m.user_id}
                        className={`flex items-center gap-4 px-5 py-3 transition-colors cursor-pointer ${
                          m.isMe ? 'bg-primary/5' : 'hover:bg-muted/50'
                        }`}
                        onClick={() => navigate(`/grouping/me?userId=${m.user_id}`)}
                      >
                         <div className="w-8 flex justify-center shrink-0 items-center">
                          {getRankIcon(m.rank)}
                        </div>
                        
                        <div className="shrink-0 relative">
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold border ${
                            m.isMe ? 'bg-primary text-white border-primary/20' : 'bg-muted text-muted-foreground border-border'
                          }`}>
                            {m.name.charAt(0).toUpperCase()}
                          </div>
                          {m.streak > 0 && (
                            <div className="absolute -bottom-1 -right-1 bg-amber-500 text-white rounded-full px-1 py-0.5 text-[7px] font-bold border border-background">
                              <Flame className="w-2.5 h-2.5 fill-current inline mr-0.5" />{m.streak}
                            </div>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className={`text-sm font-semibold truncate ${m.isMe ? 'text-primary' : 'text-foreground'}`}>
                              {m.name}
                            </p>
                            {m.isMe && (
                              <Badge className="bg-primary/10 text-primary border-none text-[9px] font-medium h-4 px-1.5">YOU</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-1">
                            <div className="flex items-center gap-1.5">
                              <span className={`text-[10px] font-semibold uppercase tracking-tight ${LEVEL_COLORS[m.level - 1]}`}>
                                {LEVEL_NAMES[m.level - 1]} <span className="opacity-50 ml-1 text-[9px]">Lv.{m.level}</span>
                              </span>
                            </div>
                            <div className="flex-1 max-w-[80px]">
                              <Progress value={getXpProgress(m.xp, m.level)} className="h-1 bg-muted" indicatorClassName={LEVEL_COLORS[m.level - 1].replace('text-', 'bg-')} />
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-5 text-right shrink-0">
                          <div className="flex flex-col items-end min-w-[50px]">
                            <span className="text-xs font-bold tabular-nums text-foreground/80">
                              {(activityPointsMap.get(m.user_id) || 0).toLocaleString()}
                            </span>
                             <span className="text-[8px] uppercase font-medium text-muted-foreground/60 tracking-wider">PTS</span>
                          </div>
                          <div className="flex flex-col items-end min-w-[60px]">
                            <span className={`text-sm font-bold tabular-nums ${m.isMe ? 'text-primary' : 'text-foreground'}`}>
                              {m.xp.toLocaleString()}
                            </span>
                            <span className="text-[8px] uppercase font-medium text-muted-foreground/60 tracking-wider">Mastery XP</span>
                          </div>
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
        <TabsContent value="ps" className="mt-0 focus-visible:outline-none">
          <Card className="rounded-xl border-border/50 shadow-sm overflow-hidden">
             <CardHeader className="py-3 px-5 bg-muted/20 border-b border-border/50">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Target className="w-4 h-4 text-emerald-500" /> Potency Progress
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {psRanked.length === 0 ? emptyState('No measurements yet.') : (
                <ScrollArea className="h-[480px]">
                  <div className="divide-y divide-border/30">
                    {psRanked.map(e => renderRankRow(e, 'POINTS', e.points, <Target className="w-2.5 h-2.5" />))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Golden Points Rank */}
        <TabsContent value="golden" className="mt-0 focus-visible:outline-none">
          <Card className="rounded-xl border-border/50 shadow-sm overflow-hidden">
            <CardHeader className="py-3 px-5 bg-muted/20 border-b border-border/50">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Coins className="w-4 h-4 text-yellow-500" /> Golden Reserves
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {pointsRanked.length === 0 ? emptyState('No rewards yet.') : (
                <ScrollArea className="h-[480px]">
                  <div className="divide-y divide-border/30">
                    {pointsRanked.map(e => renderRankRow(e, 'GOLDEN', e.points, <Coins className="w-2.5 h-2.5" />))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Activity Rank */}
        <TabsContent value="activity" className="mt-0 focus-visible:outline-none">
          <Card className="rounded-xl border-border/50 shadow-sm overflow-hidden">
             <CardHeader className="py-3 px-5 bg-muted/20 border-b border-border/50">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Star className="w-4 h-4 text-amber-500" /> Recent Contributions
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {activityRanked.length === 0 ? emptyState('Activity list is empty.') : (
                <ScrollArea className="h-[480px]">
                  <div className="divide-y divide-border/30">
                    {activityRanked.map(e => renderRankRow(e, 'POINTS', e.points, <Star className="w-2.5 h-2.5" />))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Skill-wise Rank */}
        <TabsContent value="skill" className="mt-0 focus-visible:outline-none">
          <Card className="rounded-xl border-border/50 shadow-sm overflow-hidden">
            <CardHeader className="py-3 px-5 bg-muted/20 border-b border-border/50">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 text-orange-500">
                  <Flame className="w-4 h-4" /> Skill Specializations
                </CardTitle>
                
                {availableSkills.length > 0 && (
                  <Select value={currentSkill} onValueChange={setSelectedSkill}>
                    <SelectTrigger className="w-full sm:w-[200px] h-8 text-[11px] font-semibold rounded-lg">
                      <div className="flex items-center gap-2">
                        <Flame className="w-3.5 h-3.5 text-orange-500" />
                        <SelectValue placeholder="Select Skill" />
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      {availableSkills.map(s => (
                        <SelectItem key={s} value={s} className="text-[11px] font-semibold">
                          {s.toUpperCase()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {availableSkills.length === 0 ? emptyState('No active skills.') : (
                <ScrollArea className="h-[440px]">
                  <div className="divide-y divide-border/30">
                    {(skillWiseRanked[currentSkill] || []).map(e =>
                      renderRankRow(e, 'SKILL XP', e.xp, <Flame className="w-2.5 h-2.5" />)
                    )}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
