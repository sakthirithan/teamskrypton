import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileCheck, Send, Clock, Sparkles, CheckCircle2, AlertTriangle, Calendar, RefreshCw, X, Copy, RotateCcw } from 'lucide-react';
import { MemberMonitoringStatus, ScheduledAlert } from '@/hooks/useCentralizedMonitoring';
import { formatDistanceToNow, format } from 'date-fns';

interface DailySurveyCommandCenterProps {
  members: MemberMonitoringStatus[];
  scheduledAlerts: ScheduledAlert[];
  isLeadership: boolean;
  onOpenSurveyModal: () => void;
  onSendSurveyPrompt: () => void;
  onOpenScheduleModal: () => void;
  onCancelScheduledAlert: (alertId: string) => void;
}

export function DailySurveyCommandCenter({
  members,
  scheduledAlerts,
  isLeadership,
  onOpenSurveyModal,
  onSendSurveyPrompt,
  onOpenScheduleModal,
  onCancelScheduledAlert,
}: DailySurveyCommandCenterProps) {
  const [activeAlertTab, setActiveAlertTab] = useState<'upcoming' | 'sent' | 'cancelled'>('upcoming');

  const totalMembers = members.length;
  const completedCount = members.filter((m) => m.dailySurvey.isMet).length;
  const pendingCount = totalMembers - completedCount;
  const completionPct = totalMembers > 0 ? Math.round((completedCount / totalMembers) * 100) : 0;

  const filteredScheduledAlerts = scheduledAlerts.filter((a) => {
    if (activeAlertTab === 'upcoming') return a.status === 'scheduled';
    if (activeAlertTab === 'sent') return a.status === 'sent';
    if (activeAlertTab === 'cancelled') return a.status === 'cancelled';
    return true;
  });

  return (
    <Card className="relative overflow-hidden border border-purple-500/30 bg-gradient-to-br from-card via-card to-purple-950/20 backdrop-blur-xl shadow-xl">
      {/* Top Accent Gradient */}
      <div className="h-1.5 w-full bg-gradient-to-r from-purple-500 via-indigo-500 to-pink-500" />

      <CardHeader className="p-5 pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 shadow-inner">
              <FileCheck className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-lg font-extrabold tracking-tight text-foreground flex items-center gap-2">
                Daily Survey Command Center
                <Badge variant="secondary" className="text-[10px] font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20">
                  <Sparkles className="w-2.5 h-2.5 mr-0.5" /> Authoritative DB State
                </Badge>
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5 font-medium">
                Track completion metrics, dispatch instant actionable prompts, and manage scheduled survey reminders.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              onClick={onOpenSurveyModal}
              className="gap-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold shadow-md"
            >
              <FileCheck className="w-4 h-4" /> Take Survey Now
            </Button>

            {isLeadership && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onSendSurveyPrompt}
                  className="gap-1.5 border-purple-500/30 text-purple-400 hover:bg-purple-500/10 font-bold"
                >
                  <Send className="w-4 h-4" /> Instant Prompt
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={onOpenScheduleModal}
                  className="gap-1.5 border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/10 font-bold"
                >
                  <Clock className="w-4 h-4" /> Schedule Alert
                </Button>
              </>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-5 pt-1 space-y-5">
        {/* Progress & KPI Breakdown */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 rounded-2xl bg-muted/30 border border-border/50 backdrop-blur-md">
          {/* Progress Bar Column */}
          <div className="md:col-span-2 space-y-2 flex flex-col justify-center">
            <div className="flex justify-between items-center text-xs font-bold">
              <span className="text-muted-foreground uppercase tracking-wider">Overall Survey Completion</span>
              <span className="text-purple-400 text-sm font-extrabold">{completionPct}%</span>
            </div>
            <div className="h-3 w-full bg-muted/60 rounded-full overflow-hidden p-0.5 border border-purple-500/30">
              <div
                className="h-full rounded-full bg-gradient-to-r from-purple-500 via-indigo-500 to-pink-500 transition-all duration-500 shadow-lg"
                style={{ width: `${completionPct}%` }}
              />
            </div>
            <p className="text-[11px] text-muted-foreground font-medium">
              {completedCount} of {totalMembers} eligible members completed today's survey requirement
            </p>
          </div>

          {/* Completed Pill */}
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Completed
            </span>
            <p className="text-2xl font-extrabold text-emerald-400">{completedCount}</p>
            <p className="text-[10px] text-muted-foreground font-medium">Verified submissions</p>
          </div>

          {/* Pending Pill */}
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" /> Pending
            </span>
            <p className="text-2xl font-extrabold text-amber-400">{pendingCount}</p>
            <p className="text-[10px] text-muted-foreground font-medium">Requires alert follow-up</p>
          </div>
        </div>

        {/* Scheduled Alerts Management Area */}
        {isLeadership && (
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-foreground">
                <Clock className="w-4 h-4 text-purple-400" /> Scheduled Survey Alerts
              </div>

              {/* Status Tabs */}
              <div className="flex items-center gap-1 p-1 rounded-lg bg-muted/50 border border-border/50 text-[11px]">
                <button
                  onClick={() => setActiveAlertTab('upcoming')}
                  className={`px-2.5 py-1 rounded-md font-bold transition-all ${
                    activeAlertTab === 'upcoming' ? 'bg-purple-600 text-white shadow-sm' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Upcoming ({scheduledAlerts.filter((a) => a.status === 'scheduled').length})
                </button>

                <button
                  onClick={() => setActiveAlertTab('sent')}
                  className={`px-2.5 py-1 rounded-md font-bold transition-all ${
                    activeAlertTab === 'sent' ? 'bg-purple-600 text-white shadow-sm' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Sent ({scheduledAlerts.filter((a) => a.status === 'sent').length})
                </button>

                <button
                  onClick={() => setActiveAlertTab('cancelled')}
                  className={`px-2.5 py-1 rounded-md font-bold transition-all ${
                    activeAlertTab === 'cancelled' ? 'bg-purple-600 text-white shadow-sm' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Cancelled ({scheduledAlerts.filter((a) => a.status === 'cancelled').length})
                </button>
              </div>
            </div>

            {/* List of Scheduled Items */}
            {filteredScheduledAlerts.length === 0 ? (
              <div className="p-6 text-center border border-dashed rounded-xl text-xs text-muted-foreground">
                No {activeAlertTab} survey alerts found.
              </div>
            ) : (
              <div className="space-y-2">
                {filteredScheduledAlerts.map((alert) => (
                  <div
                    key={alert.id}
                    className="p-3 rounded-xl border border-border/60 bg-card/60 backdrop-blur-sm flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-foreground">{alert.title}</span>
                        <Badge variant="outline" className="text-[9px] uppercase font-bold">
                          {alert.target_filter.replace('_', ' ')}
                        </Badge>
                        {alert.idempotent_key && (
                          <Badge variant="secondary" className="text-[9px] font-mono text-purple-400 bg-purple-500/10">
                            Idempotent
                          </Badge>
                        )}
                      </div>
                      <p className="text-muted-foreground text-[11px] line-clamp-1">{alert.message}</p>
                      <p className="text-[10px] text-purple-400 font-mono flex items-center gap-1">
                        <Calendar className="w-3 h-3" /> Scheduled for: {format(new Date(alert.scheduled_at), 'PPP p')}
                      </p>
                    </div>

                    {alert.status === 'scheduled' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 font-bold gap-1"
                        onClick={() => onCancelScheduledAlert(alert.id)}
                      >
                        <X className="w-3.5 h-3.5" /> Cancel
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
