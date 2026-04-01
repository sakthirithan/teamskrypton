import { useState } from 'react';
import { GroupingLayout } from '@/components/grouping/GroupingLayout';
import { GroupingPanel } from '@/components/grouping/GroupingPanel';
import { TargetActionPanel } from '@/components/grouping/TargetActionPanel';
import { GroupingAlertsPanel } from '@/components/grouping/GroupingAlertsPanel';
import { BulkEntryCreation } from '@/components/grouping/BulkEntryCreation';
import { SessionCard } from '@/components/grouping/SessionCard';
import { useGroupingSessions } from '@/hooks/useGroupingSessions';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { ClipboardList } from 'lucide-react';

const GroupingPS = () => {
  const { isLeadership, isCaptainOrVice } = useAuth();
  const { sessions, activeSession } = useGroupingSessions();
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const viewingSession = selectedSessionId
    ? sessions.find(s => s.id === selectedSessionId) || activeSession
    : activeSession;
  const isSessionClosed = viewingSession?.status === 'closed';

  return (
    <GroupingLayout title="PS Tracking">
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
          <div className="space-y-4">
            <GroupingPanel session={viewingSession} />

            {isLeadership && !isSessionClosed && (
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <ClipboardList className="w-4 h-4 text-primary" />
                    <span className="text-sm font-medium">PS Quick Actions</span>
                  </div>
                  <BulkEntryCreation session={viewingSession} />
                  <p className="text-xs text-muted-foreground mt-2">
                    Create PS entries for multiple members at once
                  </p>
                </CardContent>
              </Card>
            )}

            <TargetActionPanel session={viewingSession} />
            <GroupingAlertsPanel session={viewingSession} />
          </div>
        ) : (
          <Card className="border-dashed border-2 border-muted-foreground/20">
            <CardContent className="py-12 text-center">
              <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-muted/60 flex items-center justify-center">
                <ClipboardList className="w-7 h-7 text-muted-foreground/40" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">No Active Session</p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                {isCaptainOrVice
                  ? 'Create a new session from Sessions to get started.'
                  : 'Wait for leadership to create a session.'}
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </GroupingLayout>
  );
};

export default GroupingPS;
