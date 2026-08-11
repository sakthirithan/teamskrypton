import { useState, useMemo, useEffect } from 'react';
import { GroupingLayout } from '@/components/grouping/GroupingLayout';
import { PBLLayout } from '@/components/pbl/PBLLayout';
import { useAppMode } from '@/hooks/useAppMode';
import { useAuth } from '@/hooks/useAuth';
import { useMessengerChats } from '@/hooks/useMessengerChats';
import { useIsMobile } from '@/hooks/use-mobile';
import { MessengerConversation } from '@/components/messenger/MessengerConversation';
import { CreateGroupDialog } from '@/components/messenger/CreateGroupDialog';
import { CreatePollDialog } from '@/components/messenger/CreatePollDialog';
import { NotificationComposer } from '@/components/notifications/NotificationComposer';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
  MessageSquare,
  Search,
  Plus,
  Radio,
  Users,
  BarChart2,
  X,
  User,
  Activity,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { EmptyState } from '@/components/common/EmptyState';

type FilterType = 'all' | 'unread' | 'groups' | 'polls';

export default function NotificationsPage() {
  const { isGroupingMode } = useAppMode();
  const { user } = useAuth();
  const isMobile = useIsMobile();

  const {
    conversations,
    messages,
    allProfiles,
    markConversationAsRead,
    sendDirectMessage,
    sendGroupMessage,
  } = useMessengerChats();

  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterType>('all');
  const [search, setSearch] = useState('');

  // Dialog Controls
  const [composerOpen, setComposerOpen] = useState(false);
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [pollDialogOpen, setPollDialogOpen] = useState(false);

  // Filtered Active Conversations
  const filteredConversations = useMemo(() => {
    let list = conversations;

    if (filter === 'unread') {
      list = list.filter((c) => c.unread_count > 0);
    } else if (filter === 'groups') {
      list = list.filter((c) => c.type === 'group');
    } else if (filter === 'polls') {
      list = list.filter((c) => {
        const chatMsgs = messages.filter((m) => {
          if (c.type === 'group') return m.metadata?.group_id === c.group_id;
          return m.sender_id === c.other_user_id || m.recipient_id === c.other_user_id;
        });
        return chatMsgs.some((m) => m.type === 'poll' || m.metadata?.poll_id);
      });
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (c) =>
          c.title.toLowerCase().includes(q) ||
          (c.last_message || '').toLowerCase().includes(q)
      );
    }

    return list;
  }, [conversations, filter, search, messages]);

  // Real-time Contact Search: Search all team profiles
  const matchingContacts = useMemo(() => {
    if (!search.trim()) return [];
    const q = search.toLowerCase();

    // User IDs already present in filtered active chats
    const existingChatUserIds = new Set(
      filteredConversations
        .filter((c) => c.type === 'direct' && c.other_user_id)
        .map((c) => c.other_user_id!)
    );

    return allProfiles.filter((p) => {
      if (p.user_id === user?.id) return false;
      const nameMatch = (p.full_name || '').toLowerCase().includes(q);
      const emailMatch = (p.email || '').toLowerCase().includes(q);
      const deptMatch = (p.department || '').toLowerCase().includes(q);

      return (nameMatch || emailMatch || deptMatch) && !existingChatUserIds.has(p.user_id);
    });
  }, [allProfiles, search, user?.id, filteredConversations]);

  const totalUnread = useMemo(() => {
    return conversations.reduce((acc, c) => acc + c.unread_count, 0);
  }, [conversations]);

  const handleSelectChat = (chatId: string) => {
    setActiveChatId(chatId);
    markConversationAsRead(chatId);
  };

  const handleStartDirectChat = (otherUserId: string) => {
    const chatId = `direct_${otherUserId}`;
    setActiveChatId(chatId);
    markConversationAsRead(chatId);
  };

  // Sync active chat dataset attribute for MobileBottomNav visibility
  useEffect(() => {
    if (isMobile) {
      document.body.dataset.activeChat = activeChatId ? 'true' : 'false';
      window.dispatchEvent(new Event('chat-active-change'));
    } else {
      document.body.dataset.activeChat = 'false';
      window.dispatchEvent(new Event('chat-active-change'));
    }
    return () => {
      document.body.dataset.activeChat = 'false';
      window.dispatchEvent(new Event('chat-active-change'));
    };
  }, [activeChatId, isMobile]);

  const LayoutWrapper = isGroupingMode ? GroupingLayout : PBLLayout;

  return (
    <LayoutWrapper title="Messenger">
      {/* ── CONDITIONAL LAYOUT ARCHITECTURE ── */}
      {isMobile ? (
        /* ══════════════════════════════════════════════════════
           MOBILE MESSENGER LAYOUT (Screen <= 768px)
           Dedicated single-column shell using 100dvh flex
        ══════════════════════════════════════════════════════ */
        <div className="w-full flex-1 min-h-0 flex flex-col bg-background overflow-hidden relative">
          {activeChatId ? (
            /* Mobile Full Screen Chat View */
            <div className="w-full h-full flex flex-col min-h-0 bg-background overflow-hidden z-30">
              <MessengerConversation
                chatId={activeChatId}
                onBack={() => setActiveChatId(null)}
                onOpenPollDialog={() => setPollDialogOpen(true)}
              />
            </div>
          ) : (
            /* Mobile Chat List View */
            <div className="w-full h-full flex flex-col min-h-0 bg-background overflow-hidden">
              {/* Header */}
              <div className="shrink-0 p-3 border-b border-border/80 bg-card/90 backdrop-blur space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold">
                      <MessageSquare className="w-4 h-4" />
                    </div>
                    <h2 className="text-base font-bold tracking-tight text-foreground">Messenger</h2>
                    {totalUnread > 0 && (
                      <Badge variant="destructive" className="h-4 px-1.5 text-[9px] font-bold">
                        {totalUnread}
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setGroupDialogOpen(true)}
                      className="h-8 w-8 rounded-xl text-muted-foreground hover:text-foreground"
                      title="Create Group Chat"
                    >
                      <Users className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setPollDialogOpen(true)}
                      className="h-8 w-8 rounded-xl text-muted-foreground hover:text-foreground"
                      title="Create 48h Poll"
                    >
                      <BarChart2 className="w-4 h-4" />
                    </Button>

                    <Button
                      size="icon"
                      onClick={() => setComposerOpen(true)}
                      className="h-8 w-8 rounded-xl"
                      title="New Private Broadcast"
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {/* Search */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search chats, people, groups..."
                    className="h-8 pl-8 pr-8 text-xs rounded-xl bg-background"
                  />
                  {search && (
                    <button
                      onClick={() => setSearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Filter Pills */}
                <div className="flex items-center gap-1 overflow-x-auto text-xs">
                  {(['all', 'unread', 'groups', 'polls'] as FilterType[]).map((f) => (
                    <button
                      key={f}
                      onClick={() => setFilter(f)}
                      className={`px-2.5 py-1 text-[11px] font-semibold rounded-xl transition-all whitespace-nowrap ${
                        filter === f
                          ? 'bg-primary text-primary-foreground shadow-xs'
                          : 'text-muted-foreground hover:bg-muted'
                      }`}
                    >
                      {f.charAt(0).toUpperCase() + f.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Chat & Contact List */}
              <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-border/40">
                {filteredConversations.length > 0 && (
                  <div>
                    {search.trim() && matchingContacts.length > 0 && (
                      <div className="px-3 py-1 bg-muted/40 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                        Active Chats
                      </div>
                    )}
                    {filteredConversations.map((c) => (
                      <div
                        key={c.chat_id}
                        onClick={() => handleSelectChat(c.chat_id)}
                        className={`p-3 flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                          c.unread_count > 0 ? 'bg-primary/[0.04]' : 'hover:bg-muted/40'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden border border-primary/20">
                            {c.avatar_url ? (
                              <img src={c.avatar_url} alt={c.title} className="w-full h-full object-cover" />
                            ) : c.type === 'group' ? (
                              <Users className="w-5 h-5 text-primary" />
                            ) : (
                              c.title.charAt(0).toUpperCase()
                            )}
                          </div>
                          <div className="min-w-0 flex-1 space-y-0.5">
                            <div className="flex items-center justify-between gap-1">
                              <h4 className="text-xs font-bold truncate text-foreground">{c.title}</h4>
                              <span className="text-[10px] text-muted-foreground shrink-0">
                                {formatDistanceToNow(new Date(c.last_message_at), { addSuffix: false })}
                              </span>
                            </div>
                            <p className={`text-xs truncate ${c.unread_count > 0 ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>
                              {c.last_message || 'Start conversation...'}
                            </p>
                          </div>
                        </div>
                        {c.unread_count > 0 && (
                          <Badge variant="destructive" className="h-4 px-1.5 text-[9px] font-bold shrink-0">
                            {c.unread_count}
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {search.trim() && matchingContacts.length > 0 && (
                  <div>
                    <div className="px-3 py-1 bg-primary/5 text-[9px] font-bold uppercase tracking-wider text-primary">
                      People & Contacts
                    </div>
                    {matchingContacts.map((p) => (
                      <div
                        key={p.user_id}
                        onClick={() => handleStartDirectChat(p.user_id)}
                        className="p-3 flex items-center justify-between gap-3 cursor-pointer hover:bg-muted/40"
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden border border-primary/20">
                            {p.avatar_url ? (
                              <img src={p.avatar_url} alt={p.full_name} className="w-full h-full object-cover" />
                            ) : (
                              p.full_name.charAt(0).toUpperCase()
                            )}
                          </div>
                          <div className="min-w-0 flex-1 space-y-0.5">
                            <h4 className="text-xs font-bold truncate text-foreground">{p.full_name}</h4>
                            <p className="text-[10px] text-muted-foreground truncate">
                              {p.department ? `${p.department} • ` : ''}{p.email || 'Team Member'}
                            </p>
                          </div>
                        </div>
                        <Badge variant="outline" className="text-[10px] px-2 py-0.5 border-primary/30 text-primary font-bold">
                          Message
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}

                {filteredConversations.length === 0 && matchingContacts.length === 0 && (
                  <EmptyState
                    title="No matches found"
                    description={search ? `No results for "${search}"` : 'Start a chat, create a group or poll!'}
                    icon={MessageSquare}
                    className="py-8"
                  />
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* ══════════════════════════════════════════════════════
           DESKTOP MESSENGER LAYOUT (Screen > 768px)
           Fixed 320-360px left sidebar + flex-1 right conversation
        ══════════════════════════════════════════════════════ */
        <div className="flex w-full h-[calc(100vh-4rem)] sm:h-[calc(100vh-4.5rem)] overflow-hidden bg-background">
          {/* Left Sidebar */}
          <div className="flex flex-col w-[320px] lg:w-[360px] shrink-0 border-r border-border/80 bg-card/30 min-h-0">
            {/* Header */}
            <div className="shrink-0 p-3.5 border-b border-border/80 bg-card/80 backdrop-blur space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
                    <MessageSquare className="w-4 h-4" />
                  </div>
                  <h2 className="text-base font-bold tracking-tight text-foreground">Messenger</h2>
                  {totalUnread > 0 && (
                    <Badge variant="destructive" className="h-5 px-1.5 text-[10px] font-bold">
                      {totalUnread}
                    </Badge>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setGroupDialogOpen(true)}
                    className="h-8 w-8 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted"
                    title="Create Group Chat"
                  >
                    <Users className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setPollDialogOpen(true)}
                    className="h-8 w-8 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted"
                    title="Create 48h Poll"
                  >
                    <BarChart2 className="w-4 h-4" />
                  </Button>
                  <Button
                    size="icon"
                    onClick={() => setComposerOpen(true)}
                    className="h-8 w-8 rounded-xl"
                    title="New Broadcast"
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Search Input */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search chats, people, groups..."
                  className="h-8 pl-8 pr-8 text-xs rounded-xl bg-background"
                />
                {search && (
                  <button
                    onClick={() => setSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Filter Pills */}
              <div className="flex items-center gap-1 overflow-x-auto pb-1 text-xs">
                {(['all', 'unread', 'groups', 'polls'] as FilterType[]).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`px-3 py-1 font-semibold rounded-xl transition-all whitespace-nowrap ${
                      filter === f
                        ? 'bg-primary text-primary-foreground shadow-xs'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    }`}
                  >
                    {f.charAt(0).toUpperCase() + f.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Chat List */}
            <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-border/40">
              {filteredConversations.length > 0 && (
                <div>
                  {search.trim() && matchingContacts.length > 0 && (
                    <div className="px-3 py-1.5 bg-muted/30 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Active Chats
                    </div>
                  )}
                  {filteredConversations.map((c) => {
                    const isSelected = activeChatId === c.chat_id;
                    const isGroup = c.type === 'group';

                    return (
                      <div
                        key={c.chat_id}
                        onClick={() => handleSelectChat(c.chat_id)}
                        className={`p-3 flex items-center justify-between gap-3 cursor-pointer transition-colors relative ${
                          isSelected
                            ? 'bg-primary/10 border-l-[3px] border-l-primary'
                            : c.unread_count > 0
                            ? 'bg-primary/[0.03] hover:bg-muted/60'
                            : 'hover:bg-muted/40'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden border border-primary/20">
                            {c.avatar_url ? (
                              <img src={c.avatar_url} alt={c.title} className="w-full h-full object-cover" />
                            ) : isGroup ? (
                              <Users className="w-5 h-5 text-primary" />
                            ) : (
                              c.title.charAt(0).toUpperCase()
                            )}
                          </div>

                          <div className="min-w-0 flex-1 space-y-0.5">
                            <div className="flex items-center justify-between gap-1">
                              <h4 className={`text-xs font-bold truncate ${c.unread_count > 0 ? 'text-foreground' : 'text-foreground/90'}`}>
                                {c.title}
                              </h4>
                              <span className="text-[10px] text-muted-foreground shrink-0">
                                {formatDistanceToNow(new Date(c.last_message_at), { addSuffix: false })}
                              </span>
                            </div>

                            <p className={`text-xs truncate ${c.unread_count > 0 ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>
                              {c.last_message || 'Start conversation...'}
                            </p>
                          </div>
                        </div>

                        {c.unread_count > 0 && (
                          <Badge variant="destructive" className="h-5 px-1.5 text-[10px] font-bold shrink-0">
                            {c.unread_count}
                          </Badge>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {search.trim() && matchingContacts.length > 0 && (
                <div>
                  <div className="px-3 py-1.5 bg-primary/5 text-[10px] font-bold uppercase tracking-wider text-primary flex items-center justify-between">
                    <span>People & Contacts</span>
                    <span className="text-[9px] font-semibold text-muted-foreground">Tap to message</span>
                  </div>
                  {matchingContacts.map((p) => {
                    const isSelected = activeChatId === `direct_${p.user_id}`;
                    return (
                      <div
                        key={p.user_id}
                        onClick={() => handleStartDirectChat(p.user_id)}
                        className={`p-3 flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                          isSelected ? 'bg-primary/10 border-l-[3px] border-l-primary' : 'hover:bg-muted/40'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden border border-primary/20">
                            {p.avatar_url ? (
                              <img src={p.avatar_url} alt={p.full_name} className="w-full h-full object-cover" />
                            ) : (
                              p.full_name.charAt(0).toUpperCase()
                            )}
                          </div>
                          <div className="min-w-0 flex-1 space-y-0.5">
                            <h4 className="text-xs font-bold truncate text-foreground">{p.full_name}</h4>
                            <p className="text-[10px] text-muted-foreground truncate">
                              {p.department ? `${p.department} • ` : ''}{p.email || 'Team Member'}
                            </p>
                          </div>
                        </div>
                        <Badge variant="outline" className="text-[10px] px-2 py-0.5 border-primary/30 text-primary font-bold">
                          Message
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              )}

              {filteredConversations.length === 0 && matchingContacts.length === 0 && (
                <EmptyState
                  title="No matches found"
                  description={
                    search
                      ? `No contacts or messages matched "${search}".`
                      : 'Start a direct chat, create a group, or post a 48h poll!'
                  }
                  icon={MessageSquare}
                  className="py-8"
                />
              )}
            </div>
          </div>

          {/* Right Conversation Panel */}
          <div className="flex flex-col flex-1 min-h-0 min-w-0 bg-background">
            {activeChatId ? (
              <MessengerConversation
                chatId={activeChatId}
                onBack={() => setActiveChatId(null)}
                onOpenPollDialog={() => setPollDialogOpen(true)}
              />
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 text-muted-foreground space-y-3 bg-background">
                <div className="w-16 h-16 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-2xl">
                  💬
                </div>
                <h3 className="text-lg font-bold text-foreground">Teams Krypton Messenger</h3>
                <p className="text-xs max-w-xs text-muted-foreground leading-relaxed">
                  Select a chat or search for someone in the sidebar to start messaging.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Dialogs ── */}
      <CreateGroupDialog
        open={groupDialogOpen}
        onOpenChange={setGroupDialogOpen}
        onGroupCreated={(gId) => {
          setActiveChatId(`group_${gId}`);
        }}
      />

      <CreatePollDialog
        open={pollDialogOpen}
        onOpenChange={setPollDialogOpen}
        onPollCreated={(pollId, title) => {
          if (activeChatId) {
            if (activeChatId.startsWith('direct_')) {
              const otherId = activeChatId.replace('direct_', '');
              sendDirectMessage.mutate({
                recipient_id: otherId,
                message: `📊 Poll: ${title}`,
                type: 'poll',
                metadata: { poll_id: pollId },
              });
            } else if (activeChatId.startsWith('group_')) {
              const gId = activeChatId.replace('group_', '');
              const conv = conversations.find((c) => c.chat_id === activeChatId);
              const members = conv?.members || (user ? [user.id] : []);
              sendGroupMessage.mutate({
                group_id: gId,
                group_name: conv?.title || 'Group Chat',
                members,
                message: `📊 Poll: ${title}`,
                type: 'poll',
                metadata: { poll_id: pollId, group_id: gId, group_name: conv?.title },
              });
            }
          }
        }}
      />

      <Dialog open={composerOpen} onOpenChange={setComposerOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Radio className="w-5 h-5 text-primary" />
              New Private Broadcast / Message
            </DialogTitle>
          </DialogHeader>
          <NotificationComposer onSuccess={() => setComposerOpen(false)} />
        </DialogContent>
      </Dialog>
    </LayoutWrapper>
  );
}
