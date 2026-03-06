import { memo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ProjectActivity } from '@/hooks/useProjects';
import { Activity } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface ActivityFeedProps {
  activities: ProjectActivity[];
  profiles: { user_id: string; full_name: string }[];
}

export const ActivityFeed = memo(function ActivityFeed({ activities, profiles }: ActivityFeedProps) {
  const getName = (userId: string) =>
    profiles.find(p => p.user_id === userId)?.full_name || 'Unknown';

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Activity className="w-4 h-4 text-primary" />
          Activity Feed
        </CardTitle>
      </CardHeader>
      <CardContent className="max-h-[400px] overflow-y-auto scrollbar-thin">
        {activities.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">No activity yet</p>
        ) : (
          <div className="space-y-3">
            {activities.map((act) => (
              <div key={act.id} className="flex gap-3 text-sm">
                <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary text-[10px] font-semibold shrink-0 mt-0.5">
                  {getName(act.user_id).charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs">
                    <span className="font-medium">{getName(act.user_id)}</span>{' '}
                    <span className="text-muted-foreground">{act.action}</span>
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {formatDistanceToNow(new Date(act.created_at), { addSuffix: true })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
});
