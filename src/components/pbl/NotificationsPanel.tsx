import { memo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useGroupingNotifications } from '@/hooks/useGroupingNotifications';
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
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useGroupingNotifications();

  return (
    <Card className="glass-card overflow-hidden">
      <CardHeader className="pb-3 border-b border-border/40 bg-card/40 backdrop-blur-md">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Bell className="w-4 h-4 text-primary" />
            </div>
            Global Notifications
            {unreadCount > 0 && (
              <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4">
                {unreadCount} new
              </Badge>
            )}
          </CardTitle>
          {unreadCount > 0 && (
            <Button size="sm" variant="ghost" className="h-8 text-xs hover:bg-primary/10 hover:text-primary transition-all" onClick={() => markAllAsRead.mutate()}>
              <CheckCheck className="w-3.5 h-3.5 mr-1" />
              Mark all read
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[500px]">
          {notifications.length === 0 ? (
            <div className="p-8 text-center flex flex-col items-center justify-center">
              <div className="w-12 h-12 rounded-full bg-muted/40 flex items-center justify-center mb-3">
                <Bell className="w-6 h-6 text-muted-foreground/40" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">All caught up!</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Check back later for new notifications.</p>
            </div>
          ) : (
            notifications.map(n => {
              const Icon = typeIcons[n.type] || Info;
              const colorClass = typeColors[n.type] || typeColors.info;
              return (
                <div
                  key={n.id}
                  className={`flex items-start gap-3 p-4 transition-all duration-300 cursor-pointer hover:bg-muted/30 relative overflow-hidden ${
                    !n.is_read ? 'bg-primary/[0.04]' : ''
                  }`}
                  onClick={() => { if (!n.is_read) markAsRead.mutate(n.id); }}
                >
                  {!n.is_read && (
                     <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-primary shadow-[0_0_8px_var(--primary)]" />
                  )}
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border border-border/50 shadow-sm ${colorClass}`}>
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={`text-sm ${!n.is_read ? 'font-semibold text-foreground' : 'font-medium text-foreground/80'}`}>{n.title}</p>
                    </div>
                    {n.message && <p className="text-[12px] text-muted-foreground mt-1 leading-snug">{n.message}</p>}
                    <p className="text-[10px] text-muted-foreground/50 mt-1.5 uppercase font-medium tracking-wider">
                      {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
});
