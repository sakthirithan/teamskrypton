import { useMemo } from 'react';
import { ScheduleActivity } from '@/hooks/useIncharge';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, CalendarDays, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

export const HOUR_START = 6;
export const HOUR_END = 23;

export function toISODate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function startOfWeek(d: Date) {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7; // Monday first
  x.setDate(x.getDate() - day);
  return x;
}

function hourOf(time: string) {
  return parseInt(time.slice(0, 2), 10) + parseInt(time.slice(3, 5), 10) / 60;
}

const CATEGORY_STYLES: Record<string, string> = {
  general: 'bg-primary/10 border-primary/40 text-primary',
  training: 'bg-emerald-500/10 border-emerald-500/40 text-emerald-600 dark:text-emerald-400',
  review: 'bg-amber-500/10 border-amber-500/40 text-amber-600 dark:text-amber-400',
  meeting: 'bg-sky-500/10 border-sky-500/40 text-sky-600 dark:text-sky-400',
  workshop: 'bg-violet-500/10 border-violet-500/40 text-violet-600 dark:text-violet-400',
  event: 'bg-pink-500/10 border-pink-500/40 text-pink-600 dark:text-pink-400',
  deadline: 'bg-destructive/10 border-destructive/40 text-destructive',
};

export function categoryClass(category: string) {
  return CATEGORY_STYLES[category] || CATEGORY_STYLES.general;
}

interface Props {
  view: 'day' | 'week';
  onViewChange: (v: 'day' | 'week') => void;
  anchorDate: Date;
  onAnchorChange: (d: Date) => void;
  activities: ScheduleActivity[];
  subtitleFor?: (a: ScheduleActivity) => string;
  onSlotClick?: (date: string, hour: number) => void;
  onActivityClick?: (a: ScheduleActivity) => void;
  emptyHint?: string;
}

export function ScheduleCalendar({
  view,
  onViewChange,
  anchorDate,
  onAnchorChange,
  activities,
  subtitleFor,
  onSlotClick,
  onActivityClick,
  emptyHint,
}: Props) {
  const days = useMemo(() => {
    if (view === 'day') return [anchorDate];
    const s = startOfWeek(anchorDate);
    return Array.from({ length: 7 }, (_, i) => addDays(s, i));
  }, [view, anchorDate]);

  const hours = Array.from({ length: HOUR_END - HOUR_START + 1 }, (_, i) => HOUR_START + i);

  const shift = (dir: number) => onAnchorChange(addDays(anchorDate, view === 'day' ? dir : dir * 7));

  const label =
    view === 'day'
      ? anchorDate.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
      : `${days[0].toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} – ${days[6].toLocaleDateString(
          undefined,
          { day: 'numeric', month: 'short', year: 'numeric' },
        )}`;

  const forDay = (d: Date) => activities.filter((a) => a.activity_date === toISODate(d));

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border p-3">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => shift(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" className="h-8" onClick={() => onAnchorChange(new Date())}>
            Today
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => shift(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <div className="ml-2 flex items-center gap-1.5 text-sm font-medium">
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
            <span className="truncate">{label}</span>
          </div>
        </div>
        <div className="flex rounded-full border border-border p-0.5">
          {(['day', 'week'] as const).map((v) => (
            <button
              key={v}
              onClick={() => onViewChange(v)}
              className={cn(
                'rounded-full px-3 py-1 text-xs font-medium capitalize transition-colors',
                view === v ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted',
              )}
            >
              {v} view
            </button>
          ))}
        </div>
      </div>

      {/* Day headers for week view */}
      {view === 'week' && (
        <div className="grid grid-cols-[3rem_repeat(7,minmax(6.5rem,1fr))] border-b border-border bg-muted/30 text-center text-xs">
          <div />
          {days.map((d) => {
            const isToday = toISODate(d) === toISODate(new Date());
            return (
              <div key={d.toISOString()} className={cn('py-2', isToday && 'text-primary font-semibold')}>
                <div>{d.toLocaleDateString(undefined, { weekday: 'short' })}</div>
                <div className="text-sm">{d.getDate()}</div>
              </div>
            );
          })}
        </div>
      )}

      {/* Timeline */}
      <ScrollArea className="h-[60vh] md:h-[65vh]">
        <div className="min-w-full overflow-x-auto">
          <div
            className={cn(
              'grid',
              view === 'day'
                ? 'grid-cols-[3.5rem_1fr]'
                : 'grid-cols-[3rem_repeat(7,minmax(6.5rem,1fr))] min-w-[46rem]',
            )}
          >
            {hours.map((h) => (
              <div key={h} className="contents">
                <div className="border-b border-r border-border/60 px-1 py-2 text-right text-[11px] text-muted-foreground">
                  {String(h).padStart(2, '0')}:00
                </div>
                {days.map((d) => {
                  const iso = toISODate(d);
                  const slotItems = forDay(d).filter((a) => Math.floor(hourOf(a.start_time)) === h);
                  return (
                    <div
                      key={iso + h}
                      onClick={() => onSlotClick?.(iso, h)}
                      className={cn(
                        'min-h-[3.25rem] border-b border-r border-border/60 p-1 space-y-1',
                        onSlotClick && 'cursor-pointer hover:bg-muted/50 transition-colors',
                      )}
                    >
                      {slotItems.map((a) => (
                        <button
                          key={a.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            onActivityClick?.(a);
                          }}
                          className={cn(
                            'w-full rounded-md border px-2 py-1 text-left text-[11px] leading-tight',
                            categoryClass(a.category),
                            a.status === 'final' && 'ring-1 ring-primary',
                          )}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="truncate font-semibold">{a.title}</span>
                            {a.status === 'final' && (
                              <Badge variant="default" className="h-4 px-1 text-[9px]">
                                Final
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-1 opacity-80">
                            <Clock className="h-3 w-3 shrink-0" />
                            {a.start_time.slice(0, 5)}–{a.end_time.slice(0, 5)}
                          </div>
                          {subtitleFor && (
                            <div className="truncate opacity-70">{subtitleFor(a)}</div>
                          )}
                        </button>
                      ))}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </ScrollArea>

      {emptyHint && activities.length === 0 && (
        <p className="border-t border-border p-3 text-center text-xs text-muted-foreground">{emptyHint}</p>
      )}
    </div>
  );
}
