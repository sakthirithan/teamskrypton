import { useState, useMemo } from 'react';
import { GroupingLayout } from '@/components/grouping/GroupingLayout';
import { PBLLayout } from '@/components/pbl/PBLLayout';
import { useAppMode } from '@/hooks/useAppMode';
import { useGroupingNotifications, GroupingNotification } from '@/hooks/useGroupingNotifications';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { NotificationComposer } from '@/components/notifications/NotificationComposer';
import { WhatsAppText } from '@/components/ui/whatsapp-text';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
  Bell,
  CheckCheck,
  Search,
  Plus,
  Trash2,
  Clock,
  Radio,
  User,
  Users,
  UserCheck,
  Check,
  AlertTriangle,
  Info,
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';

type AudienceFilter = 'all' | 'members' | 'leads';

export default function NotificationsPage() {
  const { isGroupingMode } = useAppMode();
  const { user, isLeadership } = useAuth();
  const { notifications, unreadCount, markAsRead, markAllAsRead, deleteNotification } =
    useGroupingNotifications();

  const [filter, setFilter] = useState<AudienceFilter>('all');
  const [search, setSearch] = useState('');
  const [composerOpen, setComposerOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Fetch senders profiles map
  const { data: profilesMap = new Map<string, { full_name: string; role: string }>() } = useQuery({
    queryKey: ['profiles-map-for-notifications'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('user_id, full_name, role');
      const map = new Map<string, { full_name: string; role: string }>();
      (data || []).forEach((p) => {
        map.set(p.user_id, { full_name: p.full_name, role: p.role });
      });
      return map;
    },
  });

  const filteredNotifications = useMemo(() => {
    let list = notifications;

    if (filter === 'members') {
      list = list.filter((n) => n.target_audience === 'members' || n.target_audience === 'all' || !n.target_audience);
    } else if (filter === 'leads') {
      list = list.filter((n) => n.target_audience === 'leads' || n.target_audience === 'all');
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((n) => {
        const sender = profilesMap.get(n.sender_id)?.full_name || '';
        return (
          n.title.toLowerCase().includes(q) ||
          (n.message || '').toLowerCase().includes(q) ||
          sender.toLowerCase().includes(q)
        );
      });
    }

    return list;
  }, [notifications, filter, search, profilesMap]);

  const handleCardClick = (n: GroupingNotification) => {
    if (expandedId === n.id) {
      setExpandedId(null);
    } else {
      setExpandedId(n.id);
      if (!n.is_read) {
        markAsRead.mutate(n.id);
      }
    }
  };

  const LayoutWrapper = isGroupingMode ? GroupingLayout : PBLLayout;

  return (
    <LayoutWrapper title="Notifications">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Top Header Card */}
        <div className="krypton-card p-4 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
              <Bell className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold tracking-tight">Notification Center</h2>
                {unreadCount > 0 && (
                  <Badge variant="destructive" className="px-2 py-0.5 text-xs font-semibold">
                    {unreadCount} Unread
                  </Badge>
                )}
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                Real-time updates, targeted team alerts, and 24-hour broadcasts
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {unreadCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => markAllAsRead.mutate()}
                className="text-xs gap-1.5 flex-1 sm:flex-initial"
              >
                <CheckCheck className="w-4 h-4 text-primary" />
                Mark All Read
              </Button>
            )}

            <Dialog open={composerOpen} onOpenChange={setComposerOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1.5 text-xs flex-1 sm:flex-initial">
                  <Plus className="w-4 h-4" />
                  Compose Notification
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Radio className="w-5 h-5 text-primary" />
                    New Team Notification / Broadcast
                  </DialogTitle>
                </DialogHeader>
                <NotificationComposer onSuccess={() => setComposerOpen(false)} />
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Filter Bar & Search */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Audience Filter Tabs */}
          <div className="inline-flex p-1 bg-muted/60 rounded-lg border border-border/60 self-start sm:self-auto">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5 ${
                filter === 'all'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              All Members & Leads
            </button>
            <button
              onClick={() => setFilter('members')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5 ${
                filter === 'members'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5" />
              Members
            </button>
            <button
              onClick={() => setFilter('leads')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5 ${
                filter === 'leads'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Radio className="w-3.5 h-3.5" />
              Leads
            </button>
          </div>

          {/* Search Field */}
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search notifications or sender..."
              className="h-9 pl-9 text-xs"
            />
          </div>
        </div>

        {/* Notifications List */}
        {filteredNotifications.length === 0 ? (
          <div className="krypton-card p-12 text-center flex flex-col items-center justify-center">
            <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
              <Bell className="w-8 h-8 text-muted-foreground/40" />
            </div>
            <h3 className="text-base font-semibold text-foreground">No notifications found</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm">
              {search
                ? 'No notifications matched your search parameters.'
                : filter !== 'all'
                ? `No notifications currently available under the '${filter}' filter.`
                : 'All caught up! Check back later for new team announcements.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredNotifications.map((n) => {
              const sender = profilesMap.get(n.sender_id);
              const isExpanded = expandedId === n.id;
              const is24h = n.expires_at || n.is_broadcast;

              return (
                <div
                  key={n.id}
                  onClick={() => handleCardClick(n)}
                  className={`krypton-card p-4 transition-all duration-200 cursor-pointer relative overflow-hidden border ${
                    !n.is_read
                      ? 'border-primary/40 bg-primary/[0.03] dark:bg-primary/[0.05] shadow-sm'
                      : 'border-border/60 hover:border-border'
                  }`}
                >
                  {/* Unread Left Border Highlight */}
                  {!n.is_read && (
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-r-full shadow-[0_0_8px_hsl(var(--primary))]" />
                  )}

                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      {/* Avatar */}
                      <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                        {sender?.full_name?.charAt(0)?.toUpperCase() || 'S'}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-sm tracking-tight ${!n.is_read ? 'font-bold text-foreground' : 'font-semibold text-foreground/90'}`}>
                            {n.title}
                          </span>

                          {/* Unread Pill */}
                          {!n.is_read && (
                            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                          )}

                          {/* 24-Hour Broadcast Badge */}
                          {is24h && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-amber-500/40 text-amber-600 dark:text-amber-400 gap-1">
                              <Clock className="w-3 h-3" />
                              24h Broadcast
                            </Badge>
                          )}

                          {/* Target Audience Badge */}
                          {n.target_audience && n.target_audience !== 'direct' && (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 uppercase">
                              {n.target_audience}
                            </Badge>
                          )}
                        </div>

                        <p className="text-xs text-muted-foreground mt-0.5">
                          From <span className="font-medium text-foreground">{sender?.full_name || 'System'}</span> •{' '}
                          {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                        </p>

                        {/* Formatted Message Body Preview / Full with Read More / Show Less */}
                        {n.message && (
                          <ExpandableNotificationMessage message={n.message} isCardExpanded={isExpanded} />
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                      {!n.is_read && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-full hover:bg-primary/10 hover:text-primary"
                          onClick={() => markAsRead.mutate(n.id)}
                          title="Mark as read"
                        >
                          <Check className="w-4 h-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => deleteNotification.mutate(n.id)}
                        title="Delete notification"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </LayoutWrapper>
  );
}

function ExpandableNotificationMessage({ message, isCardExpanded }: { message: string; isCardExpanded: boolean }) {
  const [userExpanded, setUserExpanded] = useState(false);
  const isLong = message.length > 120 || message.includes('\n');
  const isShowFull = isCardExpanded || userExpanded;

  if (!isLong) {
    return (
      <div className="mt-2 text-xs sm:text-sm text-foreground/90 leading-relaxed">
        <WhatsAppText text={message} />
      </div>
    );
  }

  return (
    <div className="mt-2 text-xs sm:text-sm text-foreground/90 leading-relaxed">
      {isShowFull ? (
        <div>
          <WhatsAppText text={message} />
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setUserExpanded(false);
            }}
            className="text-primary hover:underline text-[11px] font-semibold mt-1 inline-block"
          >
            Show less
          </button>
        </div>
      ) : (
        <div>
          <WhatsAppText text={message.slice(0, 110) + '...'} />
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setUserExpanded(true);
            }}
            className="text-primary hover:underline text-[11px] font-semibold mt-1 inline-block ml-1"
          >
            Read more
          </button>
        </div>
      )}
    </div>
  );
}
