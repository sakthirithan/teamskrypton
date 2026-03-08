import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { BookOpen, Users, Flame, Trophy, TrendingUp, Star, ThumbsUp } from 'lucide-react';
import { useSkillTracks } from '@/hooks/useSkillTracks';
import { useMemberSkills } from '@/hooks/useMemberSkills';
import { useSkillEndorsements } from '@/hooks/useSkillEndorsements';
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
  streakDays: number;
  endorsementCount: number;
  portfolioCount: number;
}

export function TeamSkillOverview({ session }: TeamSkillOverviewProps) {
  const navigate = useNavigate();
  const { allSkills } = useMemberSkills();

  // Fetch all profiles
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

  // Fetch all skill tracks for this session
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

  // Fetch all streaks for this session
  const { data: allStreaks = [] } = useQuery({
    queryKey: ['all-skill-streaks', session.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('skill_streaks' as any)
        .select('*')
        .eq('session_id', session.id);
      return (data as any[]) || [];
    },
    enabled: !!session.id,
  });

  // Fetch all endorsements
  const { data: allEndorsements = [] } = useQuery({
    queryKey: ['all-endorsements-overview'],
    queryFn: async () => {
      const { data } = await supabase
        .from('skill_endorsements' as any)
        .select('*');
      return (data as any[]) || [];
    },
  });

  // Build per-member summaries
  const memberSummaries: MemberSkillSummary[] = useMemo(() => {
    return profiles.map(p => {
      const userTracks = allTracks.filter(t => t.user_id === p.user_id);
      const primaryTrack = userTracks.find(t => t.is_primary);
      const streak = allStreaks.find((s: any) => s.user_id === p.user_id);
      const endorsementCount = allEndorsements.filter((e: any) => e.endorsed_user_id === p.user_id).length;
      const portfolioCount = allSkills.filter(s => s.user_id === p.user_id).length;

      return {
        userId: p.user_id,
        fullName: p.full_name,
        trackCount: userTracks.length,
        primarySkill: primaryTrack?.skill_name || null,
        streakDays: streak?.current_streak || 0,
        endorsementCount,
        portfolioCount,
      };
    }).sort((a, b) => b.trackCount - a.trackCount || b.streakDays - a.streakDays);
  }, [profiles, allTracks, allStreaks, allEndorsements, allSkills]);

  // Aggregate stats
  const stats = useMemo(() => {
    const totalTracks = allTracks.length;
    const activeLearners = new Set(allTracks.map(t => t.user_id)).size;
    const totalMembers = profiles.length;
    const avgTracks = totalMembers > 0 ? (totalTracks / totalMembers).toFixed(1) : '0';
    const totalEndorsements = allEndorsements.length;
    const topStreak = allStreaks.reduce((max: number, s: any) => Math.max(max, s.current_streak || 0), 0);
    const activeRate = totalMembers > 0 ? Math.round((activeLearners / totalMembers) * 100) : 0;

    return { totalTracks, activeLearners, totalMembers, avgTracks, totalEndorsements, topStreak, activeRate };
  }, [allTracks, profiles, allEndorsements, allStreaks]);

  return (
    <div className="space-y-4">
      {/* Stats Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-3 text-center">
            <BookOpen className="w-5 h-5 mx-auto mb-1 text-primary" />
            <p className="text-2xl font-bold">{stats.totalTracks}</p>
            <p className="text-[10px] text-muted-foreground">Total Tracks</p>
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
            <Flame className="w-5 h-5 mx-auto mb-1 text-orange-500" />
            <p className="text-2xl font-bold">{stats.topStreak}</p>
            <p className="text-[10px] text-muted-foreground">Top Streak</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <ThumbsUp className="w-5 h-5 mx-auto mb-1 text-green-500" />
            <p className="text-2xl font-bold">{stats.totalEndorsements}</p>
            <p className="text-[10px] text-muted-foreground">Endorsements</p>
          </CardContent>
        </Card>
      </div>

      {/* Learning Activity Rate */}
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

      {/* Member Skills Table */}
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

                  <div className="flex items-center gap-3 shrink-0">
                    {member.streakDays > 0 && (
                      <Badge variant="outline" className="text-[9px] bg-orange-500/10 text-orange-600 border-orange-500/20">
                        🔥 {member.streakDays}d
                      </Badge>
                    )}
                    <div className="text-right">
                      <p className="text-sm font-semibold">{member.trackCount}</p>
                      <p className="text-[9px] text-muted-foreground">tracks</p>
                    </div>
                    {member.endorsementCount > 0 && (
                      <Badge variant="outline" className="text-[9px] bg-green-500/10 text-green-600 border-green-500/20">
                        👍 {member.endorsementCount}
                      </Badge>
                    )}
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
