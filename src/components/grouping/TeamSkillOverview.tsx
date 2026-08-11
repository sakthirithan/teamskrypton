import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { BookOpen, Users, TrendingUp, Star, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useMemberSkills } from '@/hooks/useMemberSkills';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { GroupingSession } from '@/hooks/useGroupingSessions';
import { useNavigate } from 'react-router-dom';

interface TeamSkillOverviewProps {
  session: GroupingSession;
}

interface MemberSkillSummary {
  userId: string;
  fullName: string;
  trackCount: number;
  primarySkill: string | null;
  portfolioCount: number;
  psEntryCount: number;
  hasMinimumPS: boolean;
}

export function TeamSkillOverview({ session }: TeamSkillOverviewProps) {
  const navigate = useNavigate();
  const { allSkills } = useMemberSkills();

  const { data: profiles = [] } = useQuery({
    queryKey: ['all-profiles-for-skill-overview'],
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .eq('is_test', false)
        .eq('user_type', 'real');
      return data || [];
    },
  });

  const { data: allTracks = [] } = useQuery({
    queryKey: ['all-skill-tracks', session.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('skill_tracks')
        .select('*')
        .eq('session_id', session.id);
      if (error) throw error;
      return data || [];
    },
    enabled: !!session.id,
  });

  // Minimum 1 PS entry requirement — session-bound
  const { data: psEntries = [] } = useQuery({
    queryKey: ['ps-entries-min-check', session.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ps_daily_entries')
        .select('user_id')
        .eq('session_id', session.id);
      if (error) throw error;
      return data || [];
    },
    enabled: !!session.id,
  });

  const psCountByUser = useMemo(() => {
    const m = new Map<string, number>();
    psEntries.forEach((e: any) => m.set(e.user_id, (m.get(e.user_id) || 0) + 1));
    return m;
  }, [psEntries]);

  const memberSummaries: MemberSkillSummary[] = useMemo(() => {
    return profiles.map(p => {
      const userTracks = allTracks.filter(t => t.user_id === p.user_id);
      const primaryTrack = userTracks.find(t => t.is_primary);
      const portfolioCount = allSkills.filter(s => s.user_id === p.user_id).length;
      const psEntryCount = psCountByUser.get(p.user_id) || 0;

      return {
        userId: p.user_id,
        fullName: p.full_name,
        trackCount: userTracks.length,
        primarySkill: primaryTrack?.skill_name || null,
        portfolioCount,
        psEntryCount,
        hasMinimumPS: psEntryCount >= 1,
      };
    }).sort((a, b) => b.trackCount - a.trackCount);
  }, [profiles, allTracks, allSkills, psCountByUser]);

  const pendingPSMembers = useMemo(
    () => memberSummaries.filter(m => !m.hasMinimumPS),
    [memberSummaries]
  );

  const stats = useMemo(() => {
    const totalTracks = allTracks.length;
    const activeLearners = new Set(allTracks.map(t => t.user_id)).size;
    const totalMembers = profiles.length;
    const activeRate = totalMembers > 0 ? Math.round((activeLearners / totalMembers) * 100) : 0;
    const totalPortfolio = allSkills.length;

    return { totalTracks, activeLearners, totalMembers, activeRate, totalPortfolio };
  }, [allTracks, profiles, allSkills]);


  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-3 text-center">
            <BookOpen className="w-5 h-5 mx-auto mb-1 text-primary" />
            <p className="text-2xl font-bold">{stats.totalTracks}</p>
            <p className="text-[10px] text-muted-foreground">Skill Tracks</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <Users className="w-5 h-5 mx-auto mb-1 text-primary" />
            <p className="text-2xl font-bold">{stats.activeLearners}/{stats.totalMembers}</p>
            <p className="text-[10px] text-muted-foreground">Active Learners</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <Star className="w-5 h-5 mx-auto mb-1 text-amber-500" />
            <p className="text-2xl font-bold">{stats.totalPortfolio}</p>
            <p className="text-[10px] text-muted-foreground">Portfolio Skills</p>
          </CardContent>
        </Card>
      </div>

      {/* Activity Rate */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Team Learning Activity</span>
            <span className="text-sm font-bold text-primary">{stats.activeRate}%</span>
          </div>
          <Progress value={stats.activeRate} className="h-2" />
          <p className="text-xs text-muted-foreground mt-1">
            {stats.activeLearners} of {stats.totalMembers} members actively learning this session
          </p>
        </CardContent>
      </Card>

      {/* Minimum 1 PS Entry — Pending Members (top priority) */}
      {pendingPSMembers.length > 0 ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2 px-1">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <h4 className="text-sm font-bold tracking-tight">Minimum 1 PS Entry — Pending</h4>
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-500/30 text-amber-600 dark:text-amber-500">
              {pendingPSMembers.length}/{stats.totalMembers}
            </Badge>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {pendingPSMembers.map(m => (
              <Card
                key={m.userId}
                onClick={() => navigate(`/grouping/me?userId=${m.userId}`)}
                className="p-3 cursor-pointer border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10 transition-colors rounded-2xl"
              >
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-500 flex items-center justify-center text-xs font-bold shrink-0">
                    {m.fullName.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold truncate">{m.fullName}</p>
                    <p className="text-[10px] text-amber-600 dark:text-amber-500 font-semibold">No PS entry yet</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      ) : (
        stats.totalMembers > 0 && (
          <Card className="border-emerald-500/30 bg-emerald-500/5 rounded-2xl">
            <CardContent className="p-3 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <p className="text-xs font-semibold">All members have at least 1 PS entry this session.</p>
            </CardContent>
          </Card>
        )
      )}

      {/* Member List */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            Member Skill Progress
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[360px]">
            <div className="divide-y">
              {memberSummaries.map(member => (
                <div
                  key={member.userId}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() => navigate(`/grouping/me?userId=${member.userId}`)}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{member.fullName}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      {member.primarySkill && (
                        <Badge variant="outline" className="text-[9px] px-1.5 py-0 bg-primary/10 text-primary border-primary/20">
                          <Star className="w-2.5 h-2.5 mr-0.5 fill-primary" />
                          {member.primarySkill}
                        </Badge>
                      )}
                      {member.portfolioCount > 0 && (
                        <span className="text-[10px] text-muted-foreground">
                          {member.portfolioCount} portfolio skills
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold">{member.trackCount}</p>
                    <p className="text-[9px] text-muted-foreground">tracks</p>
                  </div>
                </div>
              ))}
              {memberSummaries.length === 0 && (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  No team members found.
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
