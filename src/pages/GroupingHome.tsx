import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { GroupingLayout } from '@/components/grouping/GroupingLayout';
import { SessionCard } from '@/components/grouping/SessionCard';
import { GroupingPanel } from '@/components/grouping/GroupingPanel';
import { TeamSkillOverview } from '@/components/grouping/TeamSkillOverview';
import { useGroupingSessions } from '@/hooks/useGroupingSessions';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Target, BookOpen, ClipboardList, Calendar, TrendingUp } from 'lucide-react';
import { calculateDaysRemaining } from '@/lib/groupingConstants';
import { ROLE_LABELS } from '@/lib/constants';
import { useNavigate } from 'react-router-dom';

const GroupingHome = () => {
  const { profile, role, isLeadership, isCaptainOrVice } = useAuth();
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
    { label: 'PS Tracking', icon: ClipboardList, path: '/grouping/ps', color: 'text-blue-500' },
    ...(isLeadership
      ? [{ label: 'Team Skills', icon: BookOpen, path: '/grouping/skills', color: 'text-emerald-500' }]
      : []),
    ...(isCaptainOrVice
      ? [{ label: 'Sessions', icon: Calendar, path: '/grouping/sessions', color: 'text-purple-500' }]
      : []),
  ];

  return (
    <GroupingLayout title="Dashboard">
      <div className="space-y-6">
        {/* Welcome Banner */}
        <div className="krypton-card p-5 sm:p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-gradient-to-br from-primary/10 via-accent/5 to-transparent border border-border/80 overflow-hidden relative">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-2xl pointer-events-none" />
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-primary/15 text-primary flex items-center justify-center font-bold text-lg border border-primary/20 shrink-0">
              {profile?.full_name?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-extrabold tracking-tight text-foreground">
                Welcome back, {profile?.full_name || 'User'}!
              </h2>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-0.5 text-xs text-muted-foreground">
                <span className="text-[10px] uppercase font-extrabold tracking-wider px-2 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20">
                  {role ? ROLE_LABELS[role] : 'Team Member'}
                </span>
                <span className="opacity-50">•</span>
                <span>{profile?.department || 'Krypton Team'}</span>
              </div>
            </div>
          </div>
          {activeSession && (
            <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground bg-background/60 px-3 py-2 rounded-xl border border-border/40 shrink-0 shadow-xs">
              <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
              Active Session #{activeSession.session_number}
            </div>
          )}
        </div>

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
              <Card className="krypton-card hover:border-primary/30 transition-all border border-border/50">
                <CardContent className="p-4 text-center">
                  <Target className="w-5 h-5 mx-auto mb-1 text-primary" />
                  <p className="text-xs text-muted-foreground">Session</p>
                  <p className="text-sm font-semibold mt-0.5">#{viewingSession.session_number}</p>
                </CardContent>
              </Card>
              <Card className="krypton-card hover:border-primary/30 transition-all border border-border/50">
                <CardContent className="p-4 text-center">
                  <Calendar className="w-5 h-5 mx-auto mb-1 text-primary" />
                  <p className="text-xs text-muted-foreground">Days Left</p>
                  <p className="text-sm font-semibold mt-0.5">{viewingSession.status === 'closed' ? 'Closed' : daysRemaining}</p>
                </CardContent>
              </Card>
              <Card className="krypton-card hover:border-primary/30 transition-all border border-border/50">
                <CardContent className="p-4 text-center">
                  <TrendingUp className="w-5 h-5 mx-auto mb-1 text-primary" />
                  <p className="text-xs text-muted-foreground">Status</p>
                  <Badge variant={viewingSession.status === 'active' ? 'default' : 'secondary'} className="text-[10px] mt-1 font-bold">
                    {viewingSession.status === 'active' ? 'Active' : 'Closed'}
                  </Badge>
                </CardContent>
              </Card>
              <Card 
                className="krypton-card hover:border-primary/50 hover:bg-primary/[0.02] cursor-pointer transition-all border border-border/50" 
                onClick={() => navigate('/grouping/me')}
              >
                <CardContent className="p-4 text-center">
                  <BookOpen className="w-5 h-5 mx-auto mb-1 text-primary" />
                  <p className="text-xs text-muted-foreground">My Space</p>
                  <p className="text-sm font-semibold text-primary mt-0.5">Open →</p>
                </CardContent>
              </Card>
            </div>

            {/* Quick Links */}
            {quickLinks.length > 0 && (
              <div className="flex flex-wrap gap-3">
                {quickLinks.map((link) => (
                  <Card
                    key={link.path}
                    className="krypton-card hover:border-primary/40 hover:bg-primary/[0.01] cursor-pointer transition-all border border-border/50 flex-1 min-w-[140px]"
                    onClick={() => navigate(link.path)}
                  >
                    <CardContent className="p-3.5 flex items-center gap-2.5">
                      <link.icon className={`w-4 h-4 shrink-0 ${link.color}`} />
                      <span className="text-sm font-semibold text-foreground">{link.label}</span>
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
          <Card className="krypton-card border-dashed border-2 border-muted-foreground/20 bg-muted/5">
            <CardContent className="py-12 text-center">
              <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-muted/60 flex items-center justify-center">
                <Target className="w-7 h-7 text-muted-foreground/40" />
              </div>
              <p className="text-sm font-semibold text-muted-foreground">No Active Session</p>
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
