import { useMemo, useState } from 'react';
import { useIncharge, useTeamMembers, ScheduleActivity } from '@/hooks/useIncharge';
import { AppointInchargeCard } from './AppointInchargeCard';
import { ActivityDialog } from './ActivityDialog';
import { ScheduleCalendar, toISODate } from './ScheduleCalendar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { CalendarCheck, ClipboardList, Sparkles } from 'lucide-react';

export function InchargePanel() {
  const { user } = useAuth();
  const {
    appointments,
    activities,
    membersOf,
    myAppointments,
    isIncharge,
    isStrategist,
    isLeadership,
    canAppoint,
    appoint,
    updateAppointment,
    removeAppointment,
    saveActivity,
    deleteActivity,
    setStatus,
  } = useIncharge();
  const { data: members = [] } = useTeamMembers();

  const [view, setView] = useState<'day' | 'week'>('day');
  const [anchor, setAnchor] = useState(new Date());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ScheduleActivity | null>(null);
  const [slot, setSlot] = useState<{ date: string; hour: number }>({
    date: toISODate(new Date()),
    hour: 9,
  });

  const nameOf = (id: string) => members.find((m) => m.user_id === id)?.full_name || 'Member';
  const subtitleFor = (a: ScheduleActivity) => {
    const ids = membersOf(a.id);
    if (!ids.length) return 'No members assigned';
    return ids.length === 1 ? nameOf(ids[0]) : `${nameOf(ids[0])} +${ids.length - 1}`;
  };

  const myActivities = useMemo(
    () => activities.filter((a) => a.created_by === user?.id),
    [activities, user?.id],
  );
  const assignedToMe = useMemo(
    () => activities.filter((a) => membersOf(a.id).includes(user?.id || '') && a.status === 'final'),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activities, membersOf, user?.id],
  );

  const openSlot = (date: string, hour: number) => {
    setEditing(null);
    setSlot({ date, hour });
    setDialogOpen(true);
  };
  const openActivity = (a: ScheduleActivity) => {
    setEditing(a);
    setSlot({ date: a.activity_date, hour: parseInt(a.start_time.slice(0, 2), 10) });
    setDialogOpen(true);
  };

  const tabs = [
    ...(isIncharge ? [{ v: 'mine', label: 'My Incharge Activities' }] : []),
    ...(isStrategist ? [{ v: 'board', label: 'Schedule Board' }] : []),
    ...(isLeadership ? [{ v: 'plans', label: 'Incharge Plans' }] : []),
    ...(canAppoint ? [{ v: 'appoint', label: 'Appointments' }] : []),
  ];
  const [tab, setTab] = useState(tabs[0]?.v || 'board');

  const pendingFinal = activities.filter((a) => a.status !== 'final');

  return (
    <div className="space-y-4">
      {isIncharge && (
        <Card className="glass-card border-primary/30">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-primary" />
              Your Incharge Role
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            {myAppointments.map((a) => (
              <div key={a.id} className="min-w-[14rem] flex-1 rounded-lg border border-border p-3">
                <Badge className="mb-1.5">{a.position}</Badge>
                <p className="text-xs text-muted-foreground">
                  {a.responsibilities || 'No responsibilities described.'}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {tabs.length > 0 ? (
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full flex-wrap justify-start">
            {tabs.map((t) => (
              <TabsTrigger key={t.v} value={t.v} className="text-xs sm:text-sm">
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {isIncharge && (
            <TabsContent value="mine" className="mt-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Click any timeline slot to plan an activity.
                </p>
                <Button size="sm" onClick={() => openSlot(toISODate(anchor), 9)}>
                  New activity
                </Button>
              </div>
              <ScheduleCalendar
                view={view}
                onViewChange={setView}
                anchorDate={anchor}
                onAnchorChange={setAnchor}
                activities={myActivities}
                subtitleFor={subtitleFor}
                onSlotClick={openSlot}
                onActivityClick={openActivity}
                emptyHint="No activities planned yet — tap a slot to start."
              />
            </TabsContent>
          )}

          {isStrategist && (
            <TabsContent value="board" className="mt-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-muted-foreground">
                  All incharge activities — adjust timing, then publish the final schedule.
                </p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!pendingFinal.length}
                    onClick={() => setStatus.mutate({ ids: pendingFinal.map((a) => a.id), status: 'final' })}
                  >
                    <CalendarCheck className="mr-2 h-4 w-4" />
                    Finalise all ({pendingFinal.length})
                  </Button>
                  <Button size="sm" onClick={() => openSlot(toISODate(anchor), 9)}>
                    New activity
                  </Button>
                </div>
              </div>
              <ScheduleCalendar
                view={view}
                onViewChange={setView}
                anchorDate={anchor}
                onAnchorChange={setAnchor}
                activities={activities}
                subtitleFor={subtitleFor}
                onSlotClick={openSlot}
                onActivityClick={openActivity}
                emptyHint="No activities submitted by incharges yet."
              />
            </TabsContent>
          )}

          {isLeadership && (
            <TabsContent value="plans" className="mt-4 space-y-2">
              {appointments
                .filter((a) => a.is_active)
                .map((ap) => {
                  const items = activities.filter((a) => a.appointment_id === ap.id);
                  return (
                    <Card key={ap.id} className="glass-card">
                      <CardHeader className="pb-2">
                        <CardTitle className="flex items-center gap-2 text-sm">
                          <ClipboardList className="h-4 w-4 text-primary" />
                          {nameOf(ap.user_id)} · {ap.position}
                          <Badge variant="outline" className="text-[10px]">{items.length} activities</Badge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-1.5">
                        {items.slice(0, 6).map((a) => (
                          <button
                            key={a.id}
                            onClick={() => openActivity(a)}
                            className="flex w-full items-center justify-between rounded-md border border-border px-2 py-1.5 text-left text-xs hover:bg-muted"
                          >
                            <span className="truncate">{a.title}</span>
                            <span className="shrink-0 text-muted-foreground">
                              {a.activity_date} {a.start_time.slice(0, 5)}
                            </span>
                          </button>
                        ))}
                        {!items.length && (
                          <p className="text-xs text-muted-foreground">No activities planned yet.</p>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
            </TabsContent>
          )}

          {canAppoint && (
            <TabsContent value="appoint" className="mt-4">
              <AppointInchargeCard
                members={members}
                appointments={appointments}
                saving={appoint.isPending}
                onAppoint={(input) => appoint.mutate(input)}
                onToggle={(a) => updateAppointment.mutate({ id: a.id, is_active: !a.is_active })}
                onRemove={(id) => removeAppointment.mutate(id)}
              />
            </TabsContent>
          )}
        </Tabs>
      ) : (
        <Card className="p-6 text-center text-muted-foreground text-sm">
          No active incharge tabs available for your role. Go to <a href="/grouping/calendar" className="text-primary underline">My Calendar</a> to see your schedule.
        </Card>
      )}

      <ActivityDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        activity={editing}
        defaultDate={slot.date}
        defaultHour={slot.hour}
        members={members}
        initialMemberIds={editing ? membersOf(editing.id) : []}
        canDelete={!!editing && (editing.created_by === user?.id || isStrategist || isLeadership)}
        canEdit={!editing || editing.created_by === user?.id || isStrategist || isLeadership}
        saving={saveActivity.isPending}
        onSave={(input) => {
          saveActivity.mutate(input, { onSuccess: () => setDialogOpen(false) });
        }}
        onDelete={(id) => deleteActivity.mutate(id)}
      />
    </div>
  );
}
