import { useState } from 'react';
import { GroupingLayout } from '@/components/grouping/GroupingLayout';
import { TeamSkillOverview } from '@/components/grouping/TeamSkillOverview';
import { SkillAssignmentPanel } from '@/components/grouping/SkillAssignmentPanel';
import { SessionCard } from '@/components/grouping/SessionCard';
import { useGroupingSessions } from '@/hooks/useGroupingSessions';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { BookOpen } from 'lucide-react';

const GroupingSkills = () => {
  const { sessions, activeSession } = useGroupingSessions();
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const viewingSession = selectedSessionId
    ? sessions.find(s => s.id === selectedSessionId) || activeSession
    : activeSession;

  return (
    <GroupingLayout title="Team Skills">
      <div className="space-y-4">
        {sessions.length > 0 && (
          <SessionCard
            sessions={sessions}
            activeSession={activeSession}
            selectedSession={viewingSession}
            onSessionChange={setSelectedSessionId}
          />
        )}

        {viewingSession ? (
          <TeamSkillOverview session={viewingSession} />
        ) : (
          <Card className="border-dashed border-2 border-muted-foreground/20">
            <CardContent className="py-12 text-center">
              <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-muted/60 flex items-center justify-center">
                <BookOpen className="w-7 h-7 text-muted-foreground/40" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">No Active Session</p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                Wait for a session to be created to view team skills.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </GroupingLayout>
  );
};

export default GroupingSkills;
