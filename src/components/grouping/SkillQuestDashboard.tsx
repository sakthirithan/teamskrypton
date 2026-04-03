import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Swords, Trophy, Medal, BookOpen, Flame, Zap } from 'lucide-react';
import { SkillHeroCard } from './SkillHeroCard';
import { SkillAchievements } from './SkillAchievements';
import { SkillChallengesPanel } from './SkillChallengesPanel';
import { SkillLeaderboard } from './SkillLeaderboard';
import { SkillLevelBadge } from './SkillLevelBadge';
import { SkillTracker } from './SkillTracker';
import { DailyStudyBoard } from './DailyStudyBoard';
import { GroupingSession } from '@/hooks/useGroupingSessions';
import { useAuth } from '@/hooks/useAuth';

interface SkillQuestDashboardProps {
  session: GroupingSession;
  userId: string;
  isReadOnly?: boolean;
}

export function SkillQuestDashboard({ session, userId, isReadOnly = false }: SkillQuestDashboardProps) {
  const { isLeadership } = useAuth();
  const [activeTab, setActiveTab] = useState('skills');

  return (
    <div className="space-y-4">
      {/* Hero XP Card */}
      <SkillHeroCard sessionId={session.id} userId={userId} />

      {/* Tab Navigation */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full grid grid-cols-5 h-10 bg-muted/40 border border-border/40 rounded-xl p-0.5">
          <TabsTrigger value="skills" className="text-xs gap-1 rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm">
            <BookOpen className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Skills</span>
          </TabsTrigger>
          <TabsTrigger value="quests" className="text-xs gap-1 rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm">
            <Swords className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Quests</span>
          </TabsTrigger>
          <TabsTrigger value="badges" className="text-xs gap-1 rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm">
            <Medal className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Badges</span>
          </TabsTrigger>
          <TabsTrigger value="leaderboard" className="text-xs gap-1 rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm">
            <Trophy className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Ranks</span>
          </TabsTrigger>
          <TabsTrigger value="xp" className="text-xs gap-1 rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm">
            <Zap className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">XP Log</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="skills" className="mt-3 space-y-4">
          <SkillTracker session={session} userId={userId} isReadOnly={isReadOnly} />
          <DailyStudyBoard sessionId={session.id} userId={userId} />
        </TabsContent>

        <TabsContent value="quests" className="mt-3">
          <SkillChallengesPanel sessionId={session.id} />
        </TabsContent>

        <TabsContent value="badges" className="mt-3">
          <Card className="border-border/40">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Medal className="w-4 h-4 text-[hsl(var(--warning))]" />
                Achievement Badges
              </CardTitle>
            </CardHeader>
            <CardContent>
              <SkillAchievements sessionId={session.id} userId={userId} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="leaderboard" className="mt-3">
          <SkillLeaderboard sessionId={session.id} />
        </TabsContent>

        <TabsContent value="xp" className="mt-3">
          <SkillLevelBadge sessionId={session.id} userId={userId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
