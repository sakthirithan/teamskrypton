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
import { Card, CardContent } from '@/components/ui/card';
import { Target, MessageSquare, BookOpen, ClipboardList, NotebookPen } from 'lucide-react';

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

  // Shared empty state when no session exists
  const NoSessionPlaceholder = () => (
    <Card className="border-dashed border-2 border-muted-foreground/20">
      <CardContent className="py-12 text-center">
        <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-muted/60 flex items-center justify-center">
          <Target className="w-7 h-7 text-muted-foreground/40" />
        </div>
        <p className="text-sm font-medium text-muted-foreground">No Active Session</p>
        <p className="text-xs text-muted-foreground/70 mt-1">
          {isCaptainOrVice 
            ? 'Create a new session from the Sessions panel to get started.' 
            : 'Wait for leadership to create a session.'}
        </p>
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-3 sm:px-6 py-4 sm:py-6 safe-area-bottom page-enter">
        
        <div className={`flex flex-col ${isCaptainOrVice ? 'lg:grid lg:grid-cols-3' : ''} gap-4`}>
          {/* Main content area */}
          <div className={`${isCaptainOrVice ? 'lg:col-span-2' : ''} space-y-3 order-1`}>
            {isLeadership ? (
              <Tabs defaultValue="skills" className="w-full">
                <TabsList className="grid w-full grid-cols-4 h-10 mb-3">
                  <TabsTrigger value="skills" className="flex items-center gap-1 text-[10px] sm:text-xs px-1 sm:px-2">
                    <BookOpen className="w-3.5 h-3.5 shrink-0" />
                    <span className="hidden sm:inline truncate">Skills</span>
                  </TabsTrigger>
                  <TabsTrigger value="ps" className="flex items-center gap-1 text-[10px] sm:text-xs px-1 sm:px-2">
                    <ClipboardList className="w-3.5 h-3.5 shrink-0" />
                    <span className="hidden sm:inline truncate">PS</span>
                  </TabsTrigger>
                  <TabsTrigger value="reflections" className="flex items-center gap-1 text-[10px] sm:text-xs px-1 sm:px-2">
                    <NotebookPen className="w-3.5 h-3.5 shrink-0" />
                    <span className="hidden sm:inline truncate">Reflect</span>
                  </TabsTrigger>
                  <TabsTrigger value="notes" className="flex items-center gap-1 text-[10px] sm:text-xs px-1 sm:px-2">
                    <MessageSquare className="w-3.5 h-3.5 shrink-0" />
                    <span className="hidden sm:inline truncate">Notes</span>
                  </TabsTrigger>
                </TabsList>

                {/* Session Selector - only show if sessions exist */}
                {sessions.length > 0 && (
                  <div className="mb-3">
                    <SessionCard 
                      sessions={sessions}
                      activeSession={activeSession}
                      selectedSession={viewingSession}
                      onSessionChange={setSelectedSessionId}
                    />
                  </div>
                )}

                {/* Skills Tab */}
                <TabsContent value="skills" className="mt-0">
                  {viewingSession ? (
                    <TeamSkillOverview session={viewingSession} />
                  ) : (
                    <NoSessionPlaceholder />
                  )}
                </TabsContent>


                {/* PS Tab */}
                <TabsContent value="ps" className="mt-0">
                  {viewingSession ? (
                    <div className="space-y-3">
                      <GroupingPanel session={viewingSession} />
                      
                      {!isSessionClosed && (
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
                    <NoSessionPlaceholder />
                  )}
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
                <TabsList className="grid w-full grid-cols-3 h-10 mb-3">
                  <TabsTrigger value="ps" className="flex items-center gap-1 text-[10px] sm:text-xs px-1 sm:px-2">
                    <ClipboardList className="w-3.5 h-3.5 shrink-0" />
                    <span className="hidden sm:inline truncate">PS</span>
                  </TabsTrigger>
                  <TabsTrigger value="reflections" className="flex items-center gap-1 text-[10px] sm:text-xs px-1 sm:px-2">
                    <NotebookPen className="w-3.5 h-3.5 shrink-0" />
                    <span className="hidden sm:inline truncate">Reflect</span>
                  </TabsTrigger>
                  <TabsTrigger value="notes" className="flex items-center gap-1 text-[10px] sm:text-xs px-1 sm:px-2">
                    <MessageSquare className="w-3.5 h-3.5 shrink-0" />
                    <span className="hidden sm:inline truncate">Notes</span>
                  </TabsTrigger>
                </TabsList>

                {/* Session Selector - only show if sessions exist */}
                {sessions.length > 0 && (
                  <div className="mb-3">
                    <SessionCard 
                      sessions={sessions}
                      activeSession={activeSession}
                      selectedSession={viewingSession}
                      onSessionChange={setSelectedSessionId}
                    />
                  </div>
                )}

                <TabsContent value="ps" className="mt-0">
                  {viewingSession ? (
                    <div className="space-y-3">
                      <GroupingPanel session={viewingSession} />
                      <TargetActionPanel session={viewingSession} />
                      <GroupingAlertsPanel session={viewingSession} />
                    </div>
                  ) : (
                    <NoSessionPlaceholder />
                  )}
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
          
          {/* Sidebar - only for TL/VC */}
          {isCaptainOrVice && (
            <div className="space-y-3 order-2">
              <SessionManagementPanel />
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default GroupingHome;
