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
              <Tabs defaultValue="skills" className="w-full">
                <TabsList className="grid w-full grid-cols-4 mb-4">
                  <TabsTrigger value="skills" className="flex items-center gap-2">
                    <BookOpen className="w-4 h-4" />
                    <span className="hidden sm:inline">Skills</span>
                  </TabsTrigger>
                  <TabsTrigger value="ps" className="flex items-center gap-2">
                    <ClipboardList className="w-4 h-4" />
                    <span className="hidden sm:inline">PS</span>
                  </TabsTrigger>
                  <TabsTrigger value="reflections" className="flex items-center gap-2">
                    <NotebookPen className="w-4 h-4" />
                    <span className="hidden sm:inline">Reflections</span>
                  </TabsTrigger>
                  <TabsTrigger value="notes" className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4" />
                    <span className="hidden sm:inline">Notes</span>
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

                {/* Skills Tab */}
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

                {/* PS Tab - All PS related: Targets, Bulk Entry, Target Actions, Alerts */}
                <TabsContent value="ps" className="mt-0">
                  <div className="space-y-4">
                    <GroupingPanel session={viewingSession} />
                    
                    {viewingSession && !isSessionClosed && (
                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="flex items-center gap-2 text-base">
                            <ClipboardList className="w-4 h-4" />
                            PS Quick Actions
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
                    
                    <TargetActionPanel session={viewingSession} />
                    <GroupingAlertsPanel session={viewingSession} />
                  </div>
                </TabsContent>

                {/* Reflections Tab */}
                <TabsContent value="reflections" className="mt-0">
                  <AllReflectionsPanel />
                </TabsContent>
                
                {/* Notes Tab */}
                <TabsContent value="notes" className="mt-0">
                  <GroupingNotesPanel />
                </TabsContent>
              </Tabs>
            ) : (
              /* TEAM MEMBERS */
              <Tabs defaultValue="ps" className="w-full">
                <TabsList className="grid w-full grid-cols-3 mb-4">
                  <TabsTrigger value="ps" className="flex items-center gap-2">
                    <ClipboardList className="w-4 h-4" />
                    PS
                  </TabsTrigger>
                  <TabsTrigger value="reflections" className="flex items-center gap-2">
                    <NotebookPen className="w-4 h-4" />
                    Reflections
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
                <TabsContent value="ps" className="mt-0">
                  <div className="space-y-4">
                    <GroupingPanel session={viewingSession} />
                    <TargetActionPanel session={viewingSession} />
                    <GroupingAlertsPanel session={viewingSession} />
                  </div>
                </TabsContent>
                <TabsContent value="reflections" className="mt-0">
                  <AllReflectionsPanel />
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
          </div>
        </div>
      </main>
    </div>
  );
};

export default GroupingHome;
