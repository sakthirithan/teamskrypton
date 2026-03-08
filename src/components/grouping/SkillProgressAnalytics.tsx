import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { BarChart3, Flame, Trophy, Calendar, TrendingUp } from 'lucide-react';
import { useSkillTracks } from '@/hooks/useSkillTracks';
import { useSkillStreaks } from '@/hooks/useSkillStreaks';
import { useSkillEndorsements } from '@/hooks/useSkillEndorsements';
import { useMemberSkills } from '@/hooks/useMemberSkills';
import { GroupingSession } from '@/hooks/useGroupingSessions';

interface SkillProgressAnalyticsProps {
  session: GroupingSession;
  userId: string;
}

export function SkillProgressAnalytics({ session, userId }: SkillProgressAnalyticsProps) {
  const { tracks } = useSkillTracks(session.id, userId);
  const { streak } = useSkillStreaks(session.id, userId);
  const { endorsements } = useSkillEndorsements(userId);
  const { skills } = useMemberSkills(userId);

  // Calculate overall progress from flowchart blocks
  const overallStats = useMemo(() => {
    let totalSteps = 0;
    let completedSteps = 0;
    let inProgressSteps = 0;
    return { totalSteps, completedSteps, inProgressSteps, totalTracks: tracks.length };
  }, [tracks]);

  const streakData = streak || { current_streak: 0, longest_streak: 0, total_active_days: 0 };

  // Milestone badges
  const badges = useMemo(() => {
    const earned: { label: string; icon: string; color: string }[] = [];
    if (tracks.length >= 1) earned.push({ label: 'First Track', icon: '🎯', color: 'bg-blue-500/10 text-blue-600 border-blue-500/20' });
    if (tracks.length >= 5) earned.push({ label: '5 Skills', icon: '⭐', color: 'bg-amber-500/10 text-amber-600 border-amber-500/20' });
    if (streakData.current_streak >= 3) earned.push({ label: '3-Day Streak', icon: '🔥', color: 'bg-orange-500/10 text-orange-600 border-orange-500/20' });
    if (streakData.current_streak >= 7) earned.push({ label: 'Week Warrior', icon: '💪', color: 'bg-red-500/10 text-red-600 border-red-500/20' });
    if (streakData.longest_streak >= 14) earned.push({ label: 'Fortnight Focus', icon: '🏆', color: 'bg-purple-500/10 text-purple-600 border-purple-500/20' });
    if (endorsements.length >= 3) earned.push({ label: 'Well Endorsed', icon: '👍', color: 'bg-green-500/10 text-green-600 border-green-500/20' });
    if (endorsements.length >= 10) earned.push({ label: 'Skill Star', icon: '🌟', color: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20' });
    if (skills.length >= 3) earned.push({ label: 'Multi-Skilled', icon: '🎨', color: 'bg-teal-500/10 text-teal-600 border-teal-500/20' });
    return earned;
  }, [tracks, streakData, endorsements, skills]);

  return (
    <div className="space-y-4">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-3 text-center">
            <BarChart3 className="w-5 h-5 mx-auto mb-1 text-primary" />
            <p className="text-2xl font-bold">{overallStats.totalTracks}</p>
            <p className="text-[10px] text-muted-foreground">Skill Tracks</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <Flame className="w-5 h-5 mx-auto mb-1 text-orange-500" />
            <p className="text-2xl font-bold">{streakData.current_streak}</p>
            <p className="text-[10px] text-muted-foreground">Day Streak</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <Trophy className="w-5 h-5 mx-auto mb-1 text-amber-500" />
            <p className="text-2xl font-bold">{streakData.longest_streak}</p>
            <p className="text-[10px] text-muted-foreground">Best Streak</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <Calendar className="w-5 h-5 mx-auto mb-1 text-green-500" />
            <p className="text-2xl font-bold">{streakData.total_active_days}</p>
            <p className="text-[10px] text-muted-foreground">Active Days</p>
          </CardContent>
        </Card>
      </div>

      {/* Endorsements count */}
      {endorsements.length > 0 && (
        <Card>
          <CardContent className="p-3 flex items-center gap-3">
            <TrendingUp className="w-5 h-5 text-primary" />
            <div className="flex-1">
              <p className="text-sm font-medium">Peer Endorsements Received</p>
              <p className="text-xs text-muted-foreground">{endorsements.length} endorsement{endorsements.length !== 1 ? 's' : ''} from teammates</p>
            </div>
            <span className="text-lg font-bold text-primary">{endorsements.length}</span>
          </CardContent>
        </Card>
      )}

      {/* Milestone Badges */}
      {badges.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-1.5">
              <Trophy className="w-4 h-4 text-amber-500" />
              Earned Badges
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-3">
            <div className="flex flex-wrap gap-2">
              {badges.map((badge, idx) => (
                <Badge key={idx} variant="outline" className={`text-xs ${badge.color}`}>
                  {badge.icon} {badge.label}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
