import { useMemo, useState } from 'react';
import { useIncharge, useTeamMembers, ScheduleActivity } from '@/hooks/useIncharge';
import { ActivityDialog } from '@/components/incharge/ActivityDialog';
import { ScheduleCalendar, toISODate } from '@/components/incharge/ScheduleCalendar';
import { GroupingLayout } from '@/components/grouping/GroupingLayout';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { Calendar } from 'lucide-react';

export default function GroupingCalendar() {
  const { user } = useAuth();
  const {
    activities,
    activityMembers,
    membersOf,
    isStrategist,
    isLeadership,
    saveActivity,
    deleteActivity,
  } = useIncharge();
  const { data: members = [] } = useTeamMembers();

  const [view, setView] = useState<'day' | 'week'>('day');
  const [anchor, setAnchor] = useState(new Date());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ScheduleActivity | null>(null);

  const nameOf = (id: string) => members.find((m) => m.user_id === id)?.full_name || 'Member';
  const subtitleFor = (a: ScheduleActivity) => {
    const ids = membersOf(a.id);
    if (!ids.length) return 'No members assigned';
    return ids.length === 1 ? nameOf(ids[0]) : `${nameOf(ids[0])} +${ids.length - 1}`;
  };

  // Activities assigned to the current user (finalized only) OR created by current user (finalized)
  const assignedToMe = useMemo(
    () =>
      activities.filter(
        (a) =>
          a.status === 'final' &&
          (membersOf(a.id).includes(user?.id || '') || a.created_by === user?.id),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activities, activityMembers, user?.id],
  );

  const openActivity = (a: ScheduleActivity) => {
    setEditing(a);
    setDialogOpen(true);
  };

  const canEdit = (a: ScheduleActivity | null) => {
    if (!a || !user) return false;
    if (isLeadership || isStrategist) return true;
    if (a.status === 'final') return false;
    return a.created_by === user.id;
  };

  return (
    <GroupingLayout title="My Calendar">
      <div className="space-y-4">
        <Card className="glass-card border-primary/20">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg font-bold">
              <Calendar className="h-5 w-5 text-primary" />
              My Calendar
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              View all finalized team activities and schedule assignments mapped to you.
            </p>
          </CardHeader>
        </Card>

        <ScheduleCalendar
          view={view}
          onViewChange={setView}
          anchorDate={anchor}
          onAnchorChange={setAnchor}
          activities={assignedToMe}
          subtitleFor={subtitleFor}
          onActivityClick={openActivity}
          emptyHint="No finalized schedule activities assigned to you yet."
        />
      </div>

      <ActivityDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        activity={editing}
        defaultDate={editing ? editing.activity_date : toISODate(anchor)}
        defaultHour={editing ? parseInt(editing.start_time.slice(0, 2), 10) : 9}
        members={members}
        initialMemberIds={editing ? membersOf(editing.id) : []}
        canDelete={!!editing && canEdit(editing)}
        canEdit={canEdit(editing)}
        saving={saveActivity.isPending}
        onSave={(input) => {
          saveActivity.mutate(input, { onSuccess: () => setDialogOpen(false) });
        }}
        onDelete={(id) => deleteActivity.mutate(id)}
      />
    </GroupingLayout>
  );
}
