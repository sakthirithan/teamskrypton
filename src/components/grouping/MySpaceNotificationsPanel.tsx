import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Bell, AlertTriangle, Info, Trash2, CheckCircle2, XCircle, Coins, ClipboardList, FileCheck, ExternalLink } from 'lucide-react';
import { LinkifyText } from '@/components/ui/linkify-text';
import { useGroupingNotifications } from '@/hooks/useGroupingNotifications';
import { useCentralizedMonitoring } from '@/hooks/useCentralizedMonitoring';
import { resolveDeepLink } from '@/lib/deeplink';
import { formatDistanceToNow } from 'date-fns';
import { Button } from '@/components/ui/button';
import { NotificationActionPanel } from '@/components/notifications/NotificationActionPanel';

export function MySpaceNotificationsPanel() {
  const navigate = useNavigate();
  const { notifications, markAsRead, markAllAsRead, deleteNotification, unreadCount } = useGroupingNotifications();
  const { handleActionableResponse } = useCentralizedMonitoring();

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
      case 'daily_survey_alert':
      case 'monitoring_reminder': return <Bell className="w-4 h-4 text-purple-500" />;
      default: return <Info className="w-4 h-4 text-primary" />;
    }
  };

  const handleCardClick = (n: any, meta: any) => {
    if (!n.is_read) markAsRead.mutate(n.id);
    const targetPath = meta?.path || (n.type === 'daily_survey_alert' ? '/grouping/monitoring?open=survey' : null);
    if (targetPath) {
      const safePath = resolveDeepLink(targetPath);
      navigate(safePath);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2 font-bold">
            <Bell className="w-4 h-4 text-primary" />
            Notifications &amp; Alert Actions
            {unreadCount > 0 && (
              <Badge variant="destructive" className="h-5 px-1.5 text-[10px]">
                {unreadCount}
              </Badge>
            )}
          </span>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" className="h-7 text-xs font-semibold" onClick={() => markAllAsRead.mutate()}>
              Mark all read
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="max-h-80">
          <div className="space-y-2.5 pr-1">
            {notifications.slice(0, 20).map((n) => {
              const meta = (n.metadata || {}) as any;
              const isActionable = meta?.actionable || n.type === 'daily_survey_alert' || n.type === 'monitoring_reminder';
              const targetPath = meta?.path || '/grouping/monitoring';

              return (
                <div
                  key={n.id}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer hover:border-primary/50 ${
                    !n.is_read ? 'bg-primary/5 border-primary/30 shadow-sm' : 'bg-card border-border/60'
                  }`}
                  onClick={() => handleCardClick(n, meta)}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 shrink-0">{getIcon(n.type)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className={`text-sm leading-tight ${!n.is_read ? 'font-bold text-foreground' : 'font-medium'}`}>
                          {n.title}
                        </p>
                        <span className="text-[10px] text-muted-foreground shrink-0 font-mono">
                          {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                        </span>
                      </div>

                      {/* Explicit Detailed Status Display */}
                      {meta.ap_status ? (
                        <div className="my-2 p-2.5 rounded-lg bg-muted/40 border border-border/50 text-xs space-y-1">
                          <p className="flex items-center gap-1.5 font-medium text-amber-600 dark:text-amber-400">
                            <Coins className="w-3.5 h-3.5" /> <strong>Your current AP:</strong> {meta.ap_status}
                          </p>
                          <p className="flex items-center gap-1.5 font-medium text-blue-600 dark:text-blue-400">
                            <ClipboardList className="w-3.5 h-3.5" /> <strong>Minimum PS:</strong> {meta.ps_status}
                          </p>
                          <p className="flex items-center gap-1.5 font-medium text-purple-600 dark:text-purple-400">
                            <FileCheck className="w-3.5 h-3.5" /> <strong>Daily survey:</strong> {meta.survey_status}
                          </p>
                        </div>
                      ) : n.message ? (
                        <LinkifyText text={n.message} className="text-xs text-muted-foreground mt-1 leading-normal whitespace-pre-line" />
                      ) : null}

                      {/* Actionable Notification Panel */}
                      {isActionable && (
                        <div onClick={(e) => e.stopPropagation()}>
                          <NotificationActionPanel
                            notificationId={n.id}
                            metadata={meta}
                            onSuccess={() => markAsRead.mutate(n.id)}
                          />
                        </div>
                      )}
                    </div>

                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
                      onClick={(e) => { e.stopPropagation(); deleteNotification.mutate(n.id); }}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
