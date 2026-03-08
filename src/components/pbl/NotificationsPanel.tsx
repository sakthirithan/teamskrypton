import { memo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useProjectNotifications, useMarkNotificationRead, useMarkAllNotificationsRead } from '@/hooks/usePBLExtras';
import { Bell, CheckCheck, Info, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface Props {
  userId: string;
}

const typeIcons: Record<string, typeof Info> = {
  info: Info,
  warning: AlertTriangle,
  success: CheckCircle2,
  deadline: Clock,
  assignment: Bell,
};

const typeColors: Record<string, string> = {
  info: 'text-primary bg-primary/10',
  warning: 'text-[hsl(var(--warning))] bg-[hsl(var(--warning))]/10',
  success: 'text-[hsl(var(--success))] bg-[hsl(var(--success))]/10',
  deadline: 'text-destructive bg-destructive/10',
  assignment: 'text-primary bg-primary/10',
};

export const NotificationsPanel = memo(function NotificationsPanel({ userId }: Props) {
  const { data: notifications = [] } = useProjectNotifications(userId);
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Bell className="w-4 h-4 text-primary" />
            Notifications
            {unreadCount > 0 && (
              <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4">
                {unreadCount}
              </Badge>
            )}
          </CardTitle>
          {unreadCount > 0 && (
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => markAllRead.mutate(userId)}>
              <CheckCheck className="w-3.5 h-3.5 mr-1" />
              Mark all read
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 max-h-[400px] overflow-y-auto scrollbar-thin">
          {notifications.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">No notifications</p>
          ) : (
            notifications.map(n => {
              const Icon = typeIcons[n.type] || Info;
              const colorClass = typeColors[n.type] || typeColors.info;
              return (
                <div
                  key={n.id}
                  className={`flex items-start gap-3 p-2.5 rounded-lg transition-colors cursor-pointer hover:bg-muted/30 ${!n.is_read ? 'bg-muted/20 border border-border' : ''}`}
                  onClick={() => { if (!n.is_read) markRead.mutate({ id: n.id, userId }); }}
                >
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${colorClass}`}>
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={`text-xs ${!n.is_read ? 'font-semibold' : 'font-medium'}`}>{n.title}</p>
                      {!n.is_read && <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />}
                    </div>
                    {n.message && <p className="text-[10px] text-muted-foreground mt-0.5">{n.message}</p>}
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
});
