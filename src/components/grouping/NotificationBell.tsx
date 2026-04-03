import { useState } from 'react';
import { Bell, Check, CheckCheck, Trash2, AlertTriangle, Info, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useGroupingNotifications } from '@/hooks/useGroupingNotifications';
import { formatDistanceToNow } from 'date-fns';
import { SendNotificationDialog } from './SendNotificationDialog';

export function NotificationBell() {
  const { notifications, unreadCount, markAsRead, markAllAsRead, deleteNotification } = useGroupingNotifications();
  const [open, setOpen] = useState(false);

  const getIcon = (type: string) => {
    switch (type) {
      case 'alert': return <AlertTriangle className="w-3.5 h-3.5 text-warning" />;
      case 'warning': return <AlertTriangle className="w-3.5 h-3.5 text-destructive" />;
      default: return <Info className="w-3.5 h-3.5 text-primary" />;
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-10 w-10 hover:bg-primary/10 transition-colors duration-300 rounded-full">
          <Bell className={`h-5 w-5 transition-transform duration-300 ${unreadCount > 0 ? 'text-primary drop-shadow-[0_0_6px_var(--primary)]' : 'text-muted-foreground'}`} />
          {unreadCount > 0 && (
            <span className="absolute 0 top-0.5 right-0.5 h-4 min-w-[16px] px-1 rounded-full bg-destructive text-destructive-foreground text-[9px] font-extrabold flex items-center justify-center animate-in zoom-in shadow-md shadow-destructive/40 border border-background">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[360px] p-0 border-border/60 bg-card/85 backdrop-blur-2xl shadow-2xl rounded-xl overflow-hidden animate-in slide-in-from-top-2 duration-200">
        <div className="flex items-center justify-between p-4 border-b border-border/50 bg-gradient-to-r from-muted/50 to-transparent">
          <h4 className="text-base font-bold tracking-tight">Notifications</h4>
          <div className="flex gap-2">
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs text-primary/80 hover:text-primary hover:bg-primary/10"
                onClick={() => markAllAsRead.mutate()}
              >
                <CheckCheck className="w-3.5 h-3.5 mr-1" />
                Mark all read
              </Button>
            )}
            <SendNotificationDialog
              trigger={
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 rounded-full border-primary/20 hover:bg-primary/10 hover:text-primary"
                >
                  <Send className="w-3.5 h-3.5" />
                </Button>
              }
            />
          </div>
        </div>
        <ScrollArea className="max-h-[22rem]">
          {notifications.length === 0 ? (
            <div className="p-8 text-center flex flex-col items-center justify-center">
              <div className="w-12 h-12 rounded-full bg-muted/40 flex items-center justify-center mb-3">
                <Bell className="w-6 h-6 text-muted-foreground/40" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">All caught up!</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Check back later for new notifications.</p>
            </div>
          ) : (
            <div className="divide-y divide-border/40">
              {notifications.slice(0, 20).map((n) => (
                <div
                  key={n.id}
                  className={`p-4 flex gap-3 hover:bg-muted/40 transition-all duration-300 relative group overflow-hidden ${
                    !n.is_read ? 'bg-primary/[0.04]' : ''
                  }`}
                >
                  {!n.is_read && (
                     <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-primary rounded-r-full shadow-[0_0_8px_var(--primary)]" />
                  )}
                  <div className="mt-1 shrink-0 p-1.5 rounded-full bg-background border shadow-sm h-min">
                    {getIcon(n.type)}
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col justify-center">
                    <p className={`text-sm leading-snug tracking-tight ${!n.is_read ? 'font-semibold text-foreground' : 'font-medium text-foreground/80'}`}>
                      {n.title}
                    </p>
                    {n.message && (
                      <p className="text-[13px] text-muted-foreground mt-1 line-clamp-2 leading-relaxed">{n.message}</p>
                    )}
                    <p className="text-[10px] text-muted-foreground/50 mt-1.5 font-medium uppercase tracking-wider">
                      {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                    </p>
                  </div>
                  <div className="flex flex-col gap-1.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    {!n.is_read && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 rounded-full hover:bg-primary/10 hover:text-primary"
                        onClick={() => markAsRead.mutate(n.id)}
                      >
                        <Check className="w-3.5 h-3.5" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => deleteNotification.mutate(n.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
