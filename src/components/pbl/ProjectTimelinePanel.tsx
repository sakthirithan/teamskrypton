import { memo, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Milestone, ProjectTask } from '@/hooks/useProjects';
import { GanttChart, CheckCircle2, Circle, Clock, AlertTriangle } from 'lucide-react';
import { format, differenceInDays, isAfter, isBefore } from 'date-fns';

interface Props {
  milestones: Milestone[];
  tasks: ProjectTask[];
  startDate: string;
  deadline: string | null;
}

const statusColors: Record<string, string> = {
  not_started: 'bg-muted-foreground/30',
  in_progress: 'bg-primary',
  completed: 'bg-[hsl(var(--success))]',
  overdue: 'bg-destructive',
};

const taskStatusColors: Record<string, string> = {
  todo: 'bg-muted-foreground/30',
  in_progress: 'bg-primary',
  review: 'bg-[hsl(var(--warning))]',
  done: 'bg-[hsl(var(--success))]',
};

export const ProjectTimelinePanel = memo(function ProjectTimelinePanel({ milestones, tasks, startDate, deadline }: Props) {
  const today = new Date();
  const projectStart = new Date(startDate);
  const projectEnd = deadline ? new Date(deadline) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const totalDays = Math.max(differenceInDays(projectEnd, projectStart), 1);

  const getPosition = (dateStr: string | null) => {
    if (!dateStr) return 50;
    const date = new Date(dateStr);
    const days = differenceInDays(date, projectStart);
    return Math.max(0, Math.min(100, (days / totalDays) * 100));
  };

  const todayPosition = getPosition(today.toISOString());

  const sortedMilestones = useMemo(
    () => [...milestones].sort((a, b) => (a.due_date || '').localeCompare(b.due_date || '')),
    [milestones]
  );

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle2 className="w-3.5 h-3.5 text-[hsl(var(--success))]" />;
      case 'in_progress': return <Clock className="w-3.5 h-3.5 text-primary" />;
      case 'overdue': return <AlertTriangle className="w-3.5 h-3.5 text-destructive" />;
      default: return <Circle className="w-3.5 h-3.5 text-muted-foreground" />;
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <GanttChart className="w-4 h-4 text-primary" />
          Project Timeline
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Timeline header */}
        <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-2">
          <span>{format(projectStart, 'MMM d')}</span>
          <span>{format(projectEnd, 'MMM d, yyyy')}</span>
        </div>

        {/* Timeline bar */}
        <div className="relative h-3 bg-muted rounded-full mb-6 overflow-hidden">
          {/* Progress based on time elapsed */}
          <div
            className="absolute top-0 left-0 h-full bg-primary/20 rounded-full"
            style={{ width: `${Math.min(todayPosition, 100)}%` }}
          />
          {/* Today marker */}
          <div
            className="absolute top-0 h-full w-0.5 bg-primary z-10"
            style={{ left: `${todayPosition}%` }}
          />
        </div>

        {/* Milestone Gantt rows */}
        <div className="space-y-3">
          {sortedMilestones.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">No milestones to display</p>
          ) : (
            sortedMilestones.map((milestone) => {
              const milestoneTasks = tasks.filter(t => t.milestone_id === milestone.id);
              const doneTasks = milestoneTasks.filter(t => t.status === 'done').length;
              const progress = milestoneTasks.length > 0 ? (doneTasks / milestoneTasks.length) * 100 : 0;
              const position = getPosition(milestone.due_date);

              return (
                <div key={milestone.id} className="space-y-1">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(milestone.status)}
                    <span className="text-xs font-medium flex-1 truncate">{milestone.name}</span>
                    <span className="text-[10px] text-muted-foreground">{doneTasks}/{milestoneTasks.length}</span>
                    {milestone.due_date && (
                      <span className="text-[10px] text-muted-foreground">{format(new Date(milestone.due_date), 'MMM d')}</span>
                    )}
                  </div>
                  {/* Gantt bar */}
                  <div className="relative h-5 bg-muted/50 rounded-md overflow-hidden ml-5">
                    <div
                      className={`absolute top-0 left-0 h-full rounded-md transition-all ${statusColors[milestone.status]}`}
                      style={{ width: `${progress}%` }}
                    />
                    {/* Task dots */}
                    {milestoneTasks.map(task => (
                      <div
                        key={task.id}
                        className={`absolute top-1 w-3 h-3 rounded-full border border-background ${taskStatusColors[task.status]}`}
                        style={{ left: `${getPosition(task.due_date)}%` }}
                        title={`${task.title} - ${task.status}`}
                      />
                    ))}
                    {/* Due date marker */}
                    {milestone.due_date && (
                      <div
                        className="absolute top-0 h-full w-0.5 bg-foreground/30"
                        style={{ left: `${position}%` }}
                      />
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 mt-4 pt-3 border-t border-border">
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <div className="w-2 h-2 rounded-full bg-primary" /> Today
          </div>
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <div className="w-2 h-2 rounded-full bg-[hsl(var(--success))]" /> Done
          </div>
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <div className="w-2 h-2 rounded-full bg-[hsl(var(--warning))]" /> Review
          </div>
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <div className="w-2 h-2 rounded-full bg-muted-foreground/30" /> Todo
          </div>
        </div>
      </CardContent>
    </Card>
  );
});
