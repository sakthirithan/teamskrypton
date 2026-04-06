import { memo, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Calendar, Users, Flag, ArrowRight, Crown } from 'lucide-react';
import { format } from 'date-fns';
import { Project, ProjectTask, Milestone as MilestoneType, calculateProjectHealth } from '@/hooks/useProjects';

interface ProjectCardProps {
  project: Project;
  tasks: ProjectTask[];
  milestones: MilestoneType[];
  memberCount: number;
  leadName?: string;
  onClick: () => void;
}

const statusConfig: Record<string, { label: string; className: string }> = {
  planning: { label: 'Planning', className: 'bg-secondary text-secondary-foreground' },
  active: { label: 'Active', className: 'bg-primary/10 text-primary' },
  on_hold: { label: 'On Hold', className: 'bg-[hsl(var(--warning))]/10 text-[hsl(var(--warning))]' },
  completed: { label: 'Completed', className: 'bg-[hsl(var(--success))]/10 text-[hsl(var(--success))]' },
  archived: { label: 'Archived', className: 'bg-muted text-muted-foreground' },
};

const priorityConfig: Record<string, { label: string; className: string }> = {
  low: { label: 'Low', className: 'text-muted-foreground' },
  medium: { label: 'Medium', className: 'text-primary' },
  high: { label: 'High', className: 'text-[hsl(var(--warning))]' },
  critical: { label: 'Critical', className: 'text-destructive' },
};

export const ProjectCard = memo(function ProjectCard({
  project,
  tasks,
  milestones,
  memberCount,
  leadName,
  onClick,
}: ProjectCardProps) {
  const health = useMemo(
    () => calculateProjectHealth(tasks, milestones, project.deadline),
    [tasks, milestones, project.deadline]
  );

  const completedTasks = tasks.filter(t => t.status === 'done').length;
  const progressPercent = tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0;

  const status = statusConfig[project.status] || statusConfig.planning;
  const priority = priorityConfig[project.priority] || priorityConfig.medium;

  return (
    <Card
      className="cursor-pointer group hover:shadow-md transition-shadow duration-200"
      onClick={onClick}
    >
      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-sm truncate group-hover:text-primary transition-colors">
              {project.name}
            </h3>
            {project.description && (
              <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                {project.description}
              </p>
            )}
          </div>
          <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5" />
        </div>

        {/* Status & Priority */}
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="secondary" className={`text-[10px] ${status.className}`}>
            {status.label}
          </Badge>
          <div className={`flex items-center gap-1 text-[10px] font-medium ${priority.className}`}>
            <Flag className="w-3 h-3" />
            {priority.label}
          </div>
          <Badge
            variant="outline"
            className={`text-[10px] ml-auto ${
              health.label === 'healthy' ? 'border-[hsl(var(--success))]/40 text-[hsl(var(--success))]' :
              health.label === 'risk' ? 'border-[hsl(var(--warning))]/40 text-[hsl(var(--warning))]' :
              'border-destructive/40 text-destructive'
            }`}
          >
            {health.label === 'healthy' ? '🟢' : health.label === 'risk' ? '🟡' : '🔴'} {health.score}%
          </Badge>
        </div>

        {/* Progress */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <span>{completedTasks}/{tasks.length} tasks</span>
            <span>{progressPercent}%</span>
          </div>
          <Progress value={progressPercent} className="h-1.5" />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1 border-t border-border/50">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <Users className="w-3 h-3" />
              <span>{memberCount}</span>
            </div>
            {leadName && (
              <div className="flex items-center gap-1">
                <Crown className="w-3 h-3 text-amber-500" />
                <span className="font-medium text-foreground">{leadName}</span>
              </div>
            )}
          </div>
          {project.deadline && (
            <div className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              <span>{format(new Date(project.deadline), 'MMM d, yyyy')}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
});
