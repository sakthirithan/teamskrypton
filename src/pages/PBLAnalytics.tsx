import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { PBLLayout } from '@/components/pbl/PBLLayout';
import { useProjects, useAllProfiles } from '@/hooks/useProjects';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { BarChart3, Users, TrendingUp, Award, CheckCircle2, Clock, ListTodo } from 'lucide-react';

const PBLAnalytics = () => {
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { data: projects = [] } = useProjects();
  const { data: profiles = [] } = useAllProfiles();

  const { data: allTasks = [] } = useQuery({
    queryKey: ['all-project-tasks'],
    queryFn: async () => {
      const { data, error } = await supabase.from('project_tasks').select('*');
      if (error) throw error;
      return data || [];
    },
  });

  const { data: allMembers = [] } = useQuery({
    queryKey: ['all-project-members'],
    queryFn: async () => {
      const { data, error } = await supabase.from('project_members').select('*');
      if (error) throw error;
      return data || [];
    },
  });

  useEffect(() => {
    if (!authLoading && !user) navigate('/auth');
  }, [user, authLoading, navigate]);

  // Contribution scores per member
  const contributions = useMemo(() => {
    const memberMap = new Map<string, { name: string; tasksCompleted: number; tasksTotal: number; projectsIn: number }>();

    allMembers.forEach(m => {
      const profile = profiles.find(p => p.user_id === m.user_id);
      if (!memberMap.has(m.user_id)) {
        memberMap.set(m.user_id, {
          name: profile?.full_name || 'Unknown',
          tasksCompleted: 0,
          tasksTotal: 0,
          projectsIn: 0,
        });
      }
      memberMap.get(m.user_id)!.projectsIn++;
    });

    allTasks.forEach(t => {
      if (!t.assigned_to) return;
      if (!memberMap.has(t.assigned_to)) {
        const profile = profiles.find(p => p.user_id === t.assigned_to);
        memberMap.set(t.assigned_to, {
          name: profile?.full_name || 'Unknown',
          tasksCompleted: 0,
          tasksTotal: 0,
          projectsIn: 0,
        });
      }
      const entry = memberMap.get(t.assigned_to)!;
      entry.tasksTotal++;
      if (t.status === 'done') entry.tasksCompleted++;
    });

    return Array.from(memberMap.entries())
      .map(([userId, data]) => ({
        userId,
        ...data,
        score: data.tasksTotal > 0 ? Math.round((data.tasksCompleted / data.tasksTotal) * 100) : 0,
      }))
      .sort((a, b) => b.score - a.score);
  }, [allTasks, allMembers, profiles]);

  // Project completion stats
  const projectStats = useMemo(() => {
    return projects.map(p => {
      const pTasks = allTasks.filter(t => t.project_id === p.id);
      const done = pTasks.filter(t => t.status === 'done').length;
      return {
        id: p.id,
        name: p.name,
        status: p.status,
        totalTasks: pTasks.length,
        doneTasks: done,
        rate: pTasks.length > 0 ? Math.round((done / pTasks.length) * 100) : 0,
      };
    });
  }, [projects, allTasks]);

  if (authLoading || !user) return null;

  return (
    <PBLLayout title="Analytics">
      <div className="space-y-6 max-w-7xl mx-auto">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold">Performance Analytics</h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Project Completion Rates */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" />
                Project Completion
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 max-h-[400px] overflow-y-auto scrollbar-thin">
              {projectStats.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No projects yet</p>
              ) : (
                projectStats.map(p => (
                  <div key={p.id} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium truncate flex-1">{p.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">{p.doneTasks}/{p.totalTasks}</span>
                        <Badge variant="outline" className="text-[10px]">{p.rate}%</Badge>
                      </div>
                    </div>
                    <Progress value={p.rate} className="h-1.5" />
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Member Contributions */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Award className="w-4 h-4 text-[hsl(var(--warning))]" />
                Member Contributions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 max-h-[400px] overflow-y-auto scrollbar-thin">
              {contributions.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No data yet</p>
              ) : (
                contributions.map((member, idx) => (
                  <div key={member.userId} className="flex items-center gap-3 py-2 border-b border-border/50 last:border-0">
                    <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold shrink-0">
                      {idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{member.name}</p>
                      <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                        <span className="flex items-center gap-0.5">
                          <CheckCircle2 className="w-3 h-3" />
                          {member.tasksCompleted} done
                        </span>
                        <span className="flex items-center gap-0.5">
                          <ListTodo className="w-3 h-3" />
                          {member.tasksTotal} total
                        </span>
                        <span className="flex items-center gap-0.5">
                          <Users className="w-3 h-3" />
                          {member.projectsIn} projects
                        </span>
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className={`text-xs ${
                        member.score >= 80 ? 'text-[hsl(var(--success))] border-[hsl(var(--success))]/30' :
                        member.score >= 50 ? 'text-primary border-primary/30' :
                        'text-muted-foreground'
                      }`}
                    >
                      {member.score}%
                    </Badge>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </PBLLayout>
  );
};

export default PBLAnalytics;
