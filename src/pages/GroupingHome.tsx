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
import { TeamSkillOverview } from '@/components/grouping/TeamSkillOverview';
import { SkillAssignmentPanel } from '@/components/grouping/SkillAssignmentPanel';
import { AllReflectionsPanel } from '@/components/grouping/AllReflectionsPanel';

import { useGroupingSessions } from '@/hooks/useGroupingSessions';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Target, MessageSquare, Users, BookOpen, ClipboardList, NotebookPen } from 'lucide-react';

const GroupingHome = () => {
  const { user, isLoading, isLeadership, isCaptainOrVice, role } = useAuth();
  const { sessions, activeSession } = useGroupingSessions();
  const navigate = useNavigate();
  
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
      <main className="container mx-auto px-3 sm:px-6 py-4 sm:py-6 safe-area-bottom page-enter">
        
        <div className="flex flex-col lg:grid lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Main content area */}
          <div className="lg:col-span-2 space-y-4 sm:space-y-6 order-1">
            {isLeadership ? (
              /* LEADERSHIP: Skill-first layout with 3 tabs */
              <Tabs defaultValue="skills" className="w-full">
                <TabsList className="grid w-full grid-cols-3 mb-4">
                  <TabsTrigger value="skills" className="flex items-center gap-2">
                    <BookOpen className="w-4 h-4" />
                    Skills
                  </TabsTrigger>
                  <TabsTrigger value="targets" className="flex items-center gap-2">
                    <Target className="w-4 h-4" />
                    Targets
                  </TabsTrigger>
                  <TabsTrigger value="notes" className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4" />
                    Notes
                  </TabsTrigger>
                </TabsList>

                {/* Session Selector */}
                <div className="mb-4">
                  <SessionCard 
                    sessions={sessions}
                    activeSession={activeSession}
                    selectedSession={viewingSession}
                    onSessionChange={setSelectedSessionId}
                  />
                </div>

                {/* Skills Tab - Primary focus */}
                <TabsContent value="skills" className="mt-0">
                  {viewingSession ? (
                    <TeamSkillOverview session={viewingSession} />
                  ) : (
                    <Card>
                      <CardContent className="py-8 text-center text-muted-foreground">
                        No active session. Create a session to view skill data.
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>

                {/* Targets Tab */}
                <TabsContent value="targets" className="mt-0">
                  <GroupingPanel session={viewingSession} />
                </TabsContent>
                
                {/* Notes Tab */}
                <TabsContent value="notes" className="mt-0">
                  <GroupingNotesPanel />
                </TabsContent>
              </Tabs>
            ) : (
              /* TEAM MEMBERS: Original layout - Targets first */
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
                <div className="mb-4">
                  <SessionCard 
                    sessions={sessions}
                    activeSession={activeSession}
                    selectedSession={viewingSession}
                    onSessionChange={setSelectedSessionId}
                  />
                </div>
                <TabsContent value="targets" className="mt-0">
                  <GroupingPanel session={viewingSession} />
                </TabsContent>
                <TabsContent value="notes" className="mt-0">
                  <GroupingNotesPanel />
                </TabsContent>
              </Tabs>
            )}
          </div>
          
          {/* Sidebar */}
          <div className="space-y-4 sm:space-y-6 order-2">
            {/* Session Management for TL/VC only */}
            {isCaptainOrVice && <SessionManagementPanel />}
            
            {/* Bulk Entry Creation - lower priority for leadership */}
            {isLeadership && viewingSession && !isSessionClosed && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-base">
                      <ClipboardList className="w-4 h-4" />
                      PS Quick Actions
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
            
            {/* Target Action Panel */}
            <TargetActionPanel session={viewingSession} />
            
            {/* Alerts */}
            <GroupingAlertsPanel session={viewingSession} />
          </div>
        </div>
      </main>
    </div>
  );
};

export default GroupingHome;
