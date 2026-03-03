import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Header } from '@/components/layout/Header';
import { GroupingPanel } from '@/components/grouping/GroupingPanel';
import { TargetActionPanel } from '@/components/grouping/TargetActionPanel';
import { SessionManagementPanel } from '@/components/grouping/SessionManagementPanel';
import { GroupingAlertsPanel } from '@/components/grouping/GroupingAlertsPanel';
import { GroupingNotesPanel } from '@/components/grouping/GroupingNotesPanel';
import { BulkEntryCreation } from '@/components/grouping/BulkEntryCreation';
import { SessionCard } from '@/components/grouping/SessionCard';
import { GoogleSheetConfigPanel } from '@/components/googlesheet/GoogleSheetConfigPanel';
import { useGroupingSessions } from '@/hooks/useGroupingSessions';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Target, MessageSquare, Users } from 'lucide-react';

const GroupingHome = () => {
  const { user, isLoading, isLeadership, isCaptainOrVice, role } = useAuth();
  const { sessions, activeSession } = useGroupingSessions();
  const navigate = useNavigate();
  
  // Session switching state - allows viewing historical sessions
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const viewingSession = selectedSessionId 
    ? sessions.find(s => s.id === selectedSessionId) || activeSession
    : activeSession;
  
  const isSessionClosed = viewingSession?.status === 'closed';

  useEffect(() => {
    if (!isLoading && !user) {
      navigate('/auth');
    }
  }, [user, isLoading, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-3 sm:px-6 py-4 sm:py-6 safe-area-bottom">
        
        {/* PBL-style layout: Left 2/3, Right 1/3 */}
        <div className="flex flex-col lg:grid lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Main content area with tabs */}
          <div className="lg:col-span-2 space-y-4 sm:space-y-6 order-1">
            <Tabs defaultValue="targets" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-4">
                <TabsTrigger value="targets" className="flex items-center gap-2">
                  <Target className="w-4 h-4" />
                  Targets
                </TabsTrigger>
                <TabsTrigger value="notes" className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" />
                  Notes
                </TabsTrigger>
              </TabsList>
              {/* Session Selector Card - visible to all */}
              <Tabs className="mb-4">
                <SessionCard 
                  sessions={sessions}
                  activeSession={activeSession}
                  selectedSession={viewingSession}
                  onSessionChange={setSelectedSessionId}
                />
              </Tabs>
              <TabsContent value="targets" className="mt-0">
                <GroupingPanel session={viewingSession} />
              </TabsContent>
              
              <TabsContent value="notes" className="mt-0">
                <GroupingNotesPanel />
              </TabsContent>
            </Tabs>
          </div>
          
          {/* Sidebar */}
          <div className="space-y-4 sm:space-y-6 order-2">
            {/* Session Management for TL/VC only */}
            {isCaptainOrVice && <SessionManagementPanel />}
            
            {/* Bulk Entry Creation for Leadership - Only in active sessions */}
            {isLeadership && viewingSession && !isSessionClosed && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-base">
                      <Users className="w-4 h-4" />
                      Quick Actions
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <BulkEntryCreation session={viewingSession} />
                  <p className="text-xs text-muted-foreground mt-2">
                    Create PS entries for multiple members at once
                  </p>
                </CardContent>
              </Card>
            )}
            
            {/* Target Action Panel - session-bound */}
            <TargetActionPanel session={viewingSession} />
            
            {/* Google Sheet Config - Leadership only */}
            {isLeadership && <GoogleSheetConfigPanel />}
            
            {/* Alerts for leadership - session-bound */}
            <GroupingAlertsPanel session={viewingSession} />
          </div>
        </div>
      </main>
    </div>
  );
};

export default GroupingHome;
