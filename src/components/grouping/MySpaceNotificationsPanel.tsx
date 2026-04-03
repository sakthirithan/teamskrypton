import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Bell, AlertTriangle, Info, CheckCircle } from 'lucide-react';
import { LinkifyText } from '@/components/ui/linkify-text';
import { useGroupingNotifications } from '@/hooks/useGroupingNotifications';
import { formatDistanceToNow } from 'date-fns';
import { Button } from '@/components/ui/button';

export function MySpaceNotificationsPanel() {
  const { notifications, markAsRead, markAllAsRead, unreadCount } = useGroupingNotifications();

  if (notifications.length === 0) {
    return (
      <Card className="border-dashed border-2 border-muted-foreground/20">
        <CardContent className="py-8 text-center">
          <Bell className="w-8 h-8 mx-auto mb-2 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">No notifications yet</p>
        </CardContent>
      </Card>
    );
  }

  const getIcon = (type: string) => {
    switch (type) {
      case 'alert': return <AlertTriangle className="w-4 h-4 text-warning" />;
      case 'warning': return <AlertTriangle className="w-4 h-4 text-destructive" />;
      default: return <Info className="w-4 h-4 text-primary" />;
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2">
            <Bell className="w-4 h-4" />
            Notifications
            {unreadCount > 0 && (
              <Badge variant="destructive" className="h-5 px-1.5 text-[10px]">
                {unreadCount}
              </Badge>
            )}
          </span>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => markAllAsRead.mutate()}>
              Mark all read
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {notifications.slice(0, 10).map((n) => (
            <div
              key={n.id}
              className={`flex items-start gap-2.5 p-2.5 rounded-lg transition-colors cursor-pointer ${
                !n.is_read ? 'bg-primary/5 hover:bg-primary/10' : 'hover:bg-muted/50'
              }`}
              onClick={() => !n.is_read && markAsRead.mutate(n.id)}
            >
              <div className="mt-0.5 shrink-0">{getIcon(n.type)}</div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm leading-tight ${!n.is_read ? 'font-medium' : ''}`}>{n.title}</p>
                {n.message && (
                  <LinkifyText text={n.message} className="text-xs text-muted-foreground mt-0.5 line-clamp-2" />
                )}
                <p className="text-[10px] text-muted-foreground/60 mt-1">
                  {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                </p>
              </div>
              {!n.is_read && (
                <div className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1.5" />
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
