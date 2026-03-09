import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Activity, BookOpen, Link2, CheckCircle, Edit2, Plus, MessageSquare } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { GroupingSession } from '@/hooks/useGroupingSessions';
import { formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';

interface SkillActivityFeedProps {
  session: GroupingSession;
}

interface ActivityItem {
  id: string;
  user_id: string;
  activity_type: string;
  entity_type: string;
  description: string;
  created_at: string;
  user_name?: string;
}

const ACTIVITY_ICONS: Record<string, typeof Activity> = {
  step_added: Plus,
  step_updated: Edit2,
  status_changed: CheckCircle,
  link_added: Link2,
  skill_added: BookOpen,
  reflection_added: MessageSquare,
};

const ACTIVITY_COLORS: Record<string, string> = {
  step_added: 'bg-blue-500/10 text-blue-600',
  step_updated: 'bg-amber-500/10 text-amber-600',
  status_changed: 'bg-green-500/10 text-green-600',
  link_added: 'bg-purple-500/10 text-purple-600',
  skill_added: 'bg-primary/10 text-primary',
  reflection_added: 'bg-teal-500/10 text-teal-600',
};

export function SkillActivityFeed({ session }: SkillActivityFeedProps) {
  const navigate = useNavigate();

  const { data: activities = [], isLoading } = useQuery({
    queryKey: ['skill-activity-feed', session.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('skill_activity_log')
        .select('*')
        .eq('session_id', session.id)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as ActivityItem[];
    },
    enabled: !!session.id,
    refetchInterval: 30000, // Auto-refresh every 30s
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ['profiles-for-feed'],
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .eq('is_test', false);
      return data || [];
    },
  });

  const enrichedActivities = useMemo(() => {
    const profileMap = new Map(profiles.map(p => [p.user_id, p.full_name]));
    return activities.map(a => ({
      ...a,
      user_name: profileMap.get(a.user_id) || 'Unknown',
    }));
  }, [activities, profiles]);

  // Group by date
  const groupedByDate = useMemo(() => {
    const groups: Record<string, typeof enrichedActivities> = {};
    enrichedActivities.forEach(a => {
      const date = new Date(a.created_at).toDateString();
      if (!groups[date]) groups[date] = [];
      groups[date].push(a);
    });
    return groups;
  }, [enrichedActivities]);

  const dateKeys = Object.keys(groupedByDate);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          Loading activity feed...
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Activity className="w-4 h-4 text-primary" />
          Team Skill Activity
          {activities.length > 0 && (
            <Badge variant="secondary" className="text-[10px] ml-auto">
              {activities.length} activities
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {activities.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            No skill activity yet this session.
          </div>
        ) : (
          <ScrollArea className="h-[400px]">
            <div className="divide-y">
              {dateKeys.map(dateStr => (
                <div key={dateStr}>
                  <div className="px-4 py-2 bg-muted/30 sticky top-0 z-10">
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                      {new Date(dateStr).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                    </p>
                  </div>
                  {groupedByDate[dateStr].map(activity => {
                    const Icon = ACTIVITY_ICONS[activity.activity_type] || Activity;
                    const colorClass = ACTIVITY_COLORS[activity.activity_type] || 'bg-muted text-muted-foreground';

                    return (
                      <div
                        key={activity.id}
                        className="flex items-start gap-3 px-4 py-3 hover:bg-muted/30 cursor-pointer transition-colors"
                        onClick={() => navigate(`/grouping/me?userId=${activity.user_id}`)}
                      >
                        <div className={`p-1.5 rounded-lg shrink-0 ${colorClass}`}>
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm">
                            <span className="font-medium">{activity.user_name}</span>
                            <span className="text-muted-foreground"> {activity.description}</span>
                          </p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
