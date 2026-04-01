import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { GroupingLayout } from '@/components/grouping/GroupingLayout';
import { SessionCard } from '@/components/grouping/SessionCard';
import { GroupingPanel } from '@/components/grouping/GroupingPanel';
import { TeamSkillOverview } from '@/components/grouping/TeamSkillOverview';
import { useGroupingSessions } from '@/hooks/useGroupingSessions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Target, BookOpen, ClipboardList, Calendar, TrendingUp } from 'lucide-react';
import { calculateDaysRemaining } from '@/lib/groupingConstants';
import { useNavigate } from 'react-router-dom';

const GroupingHome = () => {
  const { isLeadership, isCaptainOrVice } = useAuth();
  const { sessions, activeSession } = useGroupingSessions();
  const navigate = useNavigate();
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const viewingSession = selectedSessionId
    ? sessions.find(s => s.id === selectedSessionId) || activeSession
    : activeSession;

  const daysRemaining = viewingSession
    ? calculateDaysRemaining(viewingSession.end_date)
    : 0;

  const quickLinks = [
    { label: 'PS Tracking', icon: ClipboardList, path: '/grouping/ps', color: 'text-blue-600' },
    ...(isLeadership
      ? [{ label: 'Team Skills', icon: BookOpen, path: '/grouping/skills', color: 'text-emerald-600' }]
      : []),
    ...(isCaptainOrVice
      ? [{ label: 'Sessions', icon: Calendar, path: '/grouping/sessions', color: 'text-purple-600' }]
      : []),
  ];

  return (
    <GroupingLayout title="Dashboard">
      <div className="space-y-4">
        {/* Session Selector */}
        {sessions.length > 0 && (
          <SessionCard
            sessions={sessions}
            activeSession={activeSession}
            selectedSession={viewingSession}
            onSessionChange={setSelectedSessionId}
          />
        )}

        {viewingSession ? (
          <>
            {/* Session Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Card>
                <CardContent className="p-4 text-center">
                  <Target className="w-5 h-5 mx-auto mb-1 text-primary" />
                  <p className="text-xs text-muted-foreground">Session</p>
                  <p className="text-sm font-semibold">#{viewingSession.session_number}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <Calendar className="w-5 h-5 mx-auto mb-1 text-primary" />
                  <p className="text-xs text-muted-foreground">Days Left</p>
                  <p className="text-sm font-semibold">{viewingSession.status === 'closed' ? 'Closed' : daysRemaining}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <TrendingUp className="w-5 h-5 mx-auto mb-1 text-primary" />
                  <p className="text-xs text-muted-foreground">Status</p>
                  <Badge variant={viewingSession.status === 'active' ? 'default' : 'secondary'} className="text-[10px] mt-0.5">
                    {viewingSession.status === 'active' ? 'Active' : 'Closed'}
                  </Badge>
                </CardContent>
              </Card>
              <Card className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => navigate('/grouping/me')}>
                <CardContent className="p-4 text-center">
                  <BookOpen className="w-5 h-5 mx-auto mb-1 text-primary" />
                  <p className="text-xs text-muted-foreground">My Space</p>
                  <p className="text-sm font-semibold text-primary">Open →</p>
                </CardContent>
              </Card>
            </div>

            {/* Quick Links */}
            {quickLinks.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {quickLinks.map((link) => (
                  <Card
                    key={link.path}
                    className="cursor-pointer hover:bg-accent/50 transition-colors flex-1 min-w-[140px]"
                    onClick={() => navigate(link.path)}
                  >
                    <CardContent className="p-3 flex items-center gap-2">
                      <link.icon className={`w-4 h-4 ${link.color}`} />
                      <span className="text-sm font-medium">{link.label}</span>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Targets Overview */}
            <GroupingPanel session={viewingSession} />

            {/* Team Skills Preview (leadership) */}
            {isLeadership && (
              <TeamSkillOverview session={viewingSession} />
            )}
          </>
        ) : (
          <Card className="border-dashed border-2 border-muted-foreground/20">
            <CardContent className="py-12 text-center">
              <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-muted/60 flex items-center justify-center">
                <Target className="w-7 h-7 text-muted-foreground/40" />
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

export default GroupingHome;
