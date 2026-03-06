import { memo, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Project, ProjectTask, Milestone, calculateProjectHealth } from '@/hooks/useProjects';
import { FolderKanban, ListTodo, CheckCircle2, AlertTriangle, TrendingUp, Clock } from 'lucide-react';

interface ProjectHealthWidgetProps {
  projects: Project[];
  allTasks: ProjectTask[];
  allMilestones: Milestone[];
}

export const ProjectHealthWidget = memo(function ProjectHealthWidget({
  projects,
  allTasks,
  allMilestones,
}: ProjectHealthWidgetProps) {
  const stats = useMemo(() => {
    const active = projects.filter(p => p.status === 'active').length;
    const completed = projects.filter(p => p.status === 'completed').length;
    const totalTasks = allTasks.length;
    const doneTasks = allTasks.filter(t => t.status === 'done').length;
    const overdueMilestones = allMilestones.filter(m => m.status === 'overdue').length;
    const completionRate = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

    // Average health
    let totalHealth = 0;
    const activeProjects = projects.filter(p => p.status === 'active');
    activeProjects.forEach(p => {
      const pTasks = allTasks.filter(t => t.project_id === p.id);
      const pMilestones = allMilestones.filter(m => m.project_id === p.id);
      totalHealth += calculateProjectHealth(pTasks, pMilestones, p.deadline).score;
    });
    const avgHealth = activeProjects.length > 0 ? Math.round(totalHealth / activeProjects.length) : 100;

    return { active, completed, totalTasks, doneTasks, overdueMilestones, completionRate, avgHealth, total: projects.length };
  }, [projects, allTasks, allMilestones]);

  const statCards = [
    { label: 'Total Projects', value: stats.total, icon: FolderKanban, color: 'text-primary' },
    { label: 'Active', value: stats.active, icon: TrendingUp, color: 'text-primary' },
    { label: 'Completed', value: stats.completed, icon: CheckCircle2, color: 'text-[hsl(var(--success))]' },
    { label: 'Tasks Done', value: `${stats.doneTasks}/${stats.totalTasks}`, icon: ListTodo, color: 'text-muted-foreground' },
  ];

  return (
    <div className="space-y-4">
      {/* Stat Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {statCards.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
              </div>
              <p className="text-2xl font-bold">{stat.value}</p>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Health Bar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Overall Health</span>
            <span className={`text-sm font-bold ${
              stats.avgHealth >= 70 ? 'text-[hsl(var(--success))]' :
              stats.avgHealth >= 40 ? 'text-[hsl(var(--warning))]' :
              'text-destructive'
            }`}>
              {stats.avgHealth}%
            </span>
          </div>
          <Progress value={stats.avgHealth} className="h-2" />
          <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
            <span>Task Completion: {stats.completionRate}%</span>
            {stats.overdueMilestones > 0 && (
              <span className="flex items-center gap-1 text-[hsl(var(--warning))]">
                <AlertTriangle className="w-3 h-3" />
                {stats.overdueMilestones} overdue milestones
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
});
