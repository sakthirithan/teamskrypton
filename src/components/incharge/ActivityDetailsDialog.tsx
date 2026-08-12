import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ScheduleActivity } from '@/hooks/useIncharge';
import { CalendarDays, Clock, MapPin, Tag, Users, FileText, CheckCircle2 } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  activity: ScheduleActivity | null;
  memberNames: string[];
  organiser?: string;
}

const STATUS_LABEL: Record<string, string> = {
  proposed: 'Proposed',
  scheduled: 'Scheduled',
  final: 'Finalized',
};

function Row({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 rounded-xl border border-border/70 bg-muted/30 p-3">
      <div className="mt-0.5 text-primary">{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
        <div className="text-sm break-words">{children}</div>
      </div>
    </div>
  );
}

export function ActivityDetailsDialog({ open, onOpenChange, activity, memberNames, organiser }: Props) {
  if (!activity) return null;

  const dateLabel = new Date(`${activity.activity_date}T00:00:00`).toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-lg max-h-[92vh] overflow-hidden p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="pr-6 text-left text-base leading-snug">{activity.title}</DialogTitle>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Badge variant="outline" className="capitalize text-[10px]">
              {activity.category}
            </Badge>
            <Badge
              className={`text-[10px] ${
                activity.status === 'final'
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500 border border-emerald-500/20'
                  : 'bg-amber-500/10 text-amber-600 dark:text-amber-500 border border-amber-500/20'
              }`}
            >
              {activity.status === 'final' && <CheckCircle2 className="mr-1 h-3 w-3" />}
              {STATUS_LABEL[activity.status] || activity.status}
            </Badge>
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[65vh] pr-3">
          <div className="space-y-2.5">
            <Row icon={<FileText className="h-4 w-4" />} label="Description">
              {activity.description?.trim() || <span className="text-muted-foreground">No description provided.</span>}
            </Row>

            <div className="grid gap-2.5 sm:grid-cols-2">
              <Row icon={<CalendarDays className="h-4 w-4" />} label="Date">
                {dateLabel}
              </Row>
              <Row icon={<Clock className="h-4 w-4" />} label="Time">
                {activity.start_time.slice(0, 5)} – {activity.end_time.slice(0, 5)}
              </Row>
            </div>

            <Row icon={<MapPin className="h-4 w-4" />} label="Venue">
              {activity.location?.trim() || <span className="text-muted-foreground">Not specified</span>}
            </Row>

            <Row icon={<Users className="h-4 w-4" />} label={`Assigned members (${memberNames.length})`}>
              {memberNames.length ? (
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {memberNames.map((n) => (
                    <span key={n} className="rounded-lg bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                      {n}
                    </span>
                  ))}
                </div>
              ) : (
                <span className="text-muted-foreground">No members assigned</span>
              )}
            </Row>

            <Row icon={<Tag className="h-4 w-4" />} label="Organised by">
              {organiser || 'Team Incharge'}
            </Row>

            {activity.finalized_at && (
              <p className="px-1 text-[11px] text-muted-foreground">
                Finalized on {new Date(activity.finalized_at).toLocaleString()}
              </p>
            )}
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
