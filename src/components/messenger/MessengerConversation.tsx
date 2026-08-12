import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useMessengerChats, ChatMessage, MESSAGE_RETENTION_DAYS } from '@/hooks/useMessengerChats';
import { WhatsAppText } from '@/components/ui/whatsapp-text';
import { MessengerPollCard } from './MessengerPollCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  ArrowLeft,
  Send,
  Bold,
  Italic,
  Strikethrough,
  Code,
  Smile,
  Reply as ReplyIcon,
  Trash2,
  Copy,
  Check,
  CheckCheck,
  BarChart2,
  Users,
  X,
  MoreVertical,
  ChevronDown,
  Search,
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

const EMOJI_LIST = ['❤️', '👍', '😂', '😮', '😢', '🙏', '🔥', '🎉'];

/** Formatted text bubble with Expand / Collapse for long messages (>300 chars) */
function ExpandableMessageText({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = text.length > 300;

  const displayText = useMemo(() => {
    if (!isLong || expanded) return text;
    return text.slice(0, 280) + '...';
  }, [text, isLong, expanded]);

  return (
    <div className="space-y-1">
      <div className="text-xs sm:text-sm leading-relaxed break-words">
        <WhatsAppText text={displayText} />
      </div>
      {isLong && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-[11px] font-bold underline opacity-80 hover:opacity-100 transition-opacity block pt-0.5"
        >
          {expanded ? '[Show less]' : '[Show more]'}
        </button>
      )}
    </div>
  );
}

interface MessengerConversationProps {
  chatId: string;
  onBack?: () => void;
  onOpenPollDialog?: () => void;
}

export function MessengerConversation({ chatId, onBack, onOpenPollDialog }: MessengerConversationProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const {
    messages,
    conversations,
    profilesMap,
    sendDirectMessage,
    sendGroupMessage,
    deleteGroup,
    toggleReaction,
    deleteMessage,
    markConversationAsRead,
  } = useMessengerChats();

  const [inputText, setInputText] = useState('');
  const [replyTarget, setReplyTarget] = useState<ChatMessage | null>(null);
  const expirationDays = MESSAGE_RETENTION_DAYS; // fixed 2-day retention policy
  const [searchInChat, setSearchInChat] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [showNewMsgBanner, setShowNewMsgBanner] = useState(false);
  const [isNearBottom, setIsNearBottom] = useState(true);

  // Scroll refs
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLInputElement>(null);
  const lastMsgCountRef = useRef(0);

  // Determine chat type & targets
  const isGroup = chatId.startsWith('group_');
  const isDirect = chatId.startsWith('direct_');
  const targetId = chatId.replace(/^(direct_|group_)/, '');

  // Active conversation record if exists in persistent conversations
  const currentConv = useMemo(() => {
    return conversations.find((c) => c.chat_id === chatId);
  }, [conversations, chatId]);

  // Filter messages belonging to this chat
  const chatMessages = useMemo(() => {
    return messages.filter((m) => {
      if (isDirect) {
        return (
          (m.sender_id === user?.id && m.recipient_id === targetId) ||
          (m.sender_id === targetId && m.recipient_id === user?.id)
        );
      }
      if (isGroup) {
        // Support both new top-level group_id column and legacy metadata.group_id
        const resolvedGroupId = (m as any).group_id || m.metadata?.group_id;
        return resolvedGroupId === targetId;
      }
      return false;
    });
  }, [messages, isDirect, isGroup, targetId, user]);

  const filteredMessages = useMemo(() => {
    if (!searchInChat.trim()) return chatMessages;
    const q = searchInChat.toLowerCase();
    return chatMessages.filter(
      (m) =>
        (m.message || '').toLowerCase().includes(q) ||
        (m.title || '').toLowerCase().includes(q)
    );
  }, [chatMessages, searchInChat]);

  // Derive Chat Title & Avatar
  const chatInfo = useMemo(() => {
    if (isDirect) {
      const p = profilesMap.get(targetId);
      return {
        title: p?.full_name || 'Team Member',
        subtitle: p?.department ? `${p.department} • Direct` : 'Direct Message',
        avatar_url: p?.avatar_url,
      };
    }
    if (isGroup) {
      const sampleMsg = chatMessages[0];
      const gName = currentConv?.title || sampleMsg?.metadata?.group_name || sampleMsg?.title || 'Group Chat';
      const membersCount = currentConv?.members?.length || sampleMsg?.metadata?.group_members?.length || 2;
      return {
        title: gName,
        subtitle: `${membersCount} members • Group`,
        avatar_url: currentConv?.avatar_url || sampleMsg?.metadata?.group_avatar,
        creator_id: currentConv?.creator_id,
      };
    }
    return { title: 'Conversation', subtitle: '', avatar_url: null };
  }, [isDirect, isGroup, targetId, profilesMap, chatMessages, currentConv]);

  // Handle group deletion by creator
  const handleDeleteGroup = async () => {
    if (!isGroup || !targetId) return;
    if (window.confirm(`Are you sure you want to delete "${chatInfo.title}"? This cannot be undone.`)) {
      await deleteGroup.mutateAsync(targetId);
      if (onBack) onBack();
    }
  };

  // ── Scroll-position tracking ──
  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const near = distFromBottom < 80;
    setIsNearBottom(near);
    if (near) setShowNewMsgBanner(false);
  }, []);

  // ── Auto-scroll / new-message banner logic ──
  useEffect(() => {
    const newCount = filteredMessages.length;
    const prev = lastMsgCountRef.current;

    if (newCount > prev) {
      if (isNearBottom) {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      } else {
        setShowNewMsgBanner(true);
      }
    }
    lastMsgCountRef.current = newCount;
  }, [filteredMessages.length, isNearBottom]);

  // Initial scroll to bottom when conversation opens
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'instant' });
    setShowNewMsgBanner(false);
    lastMsgCountRef.current = filteredMessages.length;
  }, [chatId]);

  // Mark as read upon opening
  useEffect(() => {
    if (chatId) {
      const timer = setTimeout(() => {
        markConversationAsRead(chatId);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [chatId, markConversationAsRead]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    setShowNewMsgBanner(false);
  };

  const applyFormat = (prefix: string, suffix: string = prefix) => {
    const input = textareaRef.current;
    if (!input) return;
    setInputText((prev) => `${prev}${prefix}text${suffix}`);
    setTimeout(() => input.focus(), 50);
  };

  const handleSendMessage = async () => {
    if (!inputText.trim() || !user) return;
    const msgText = inputText.trim();
    setInputText('');

    const replyData = replyTarget
      ? {
          id: replyTarget.id,
          title: replyTarget.title,
          message: replyTarget.message || '',
          sender_name: profilesMap.get(replyTarget.sender_id)?.full_name || 'Member',
        }
      : undefined;

    setReplyTarget(null);

    try {
      if (isDirect) {
        await sendDirectMessage.mutateAsync({
          recipient_id: targetId,
          message: msgText,
          reply_to: replyData,
          expiration_days: expirationDays,
        });
      } else if (isGroup) {
        // Prefer members from the persistent conversation record (currentConv),
        // then fall back to the last message's metadata, then a minimal default.
        // resolveGroupMembers() in the hook will re-fetch from DB anyway.
        const gMembers =
          currentConv?.members ||
          chatMessages[0]?.metadata?.group_members ||
          (chatMessages[0] as any)?.group_members ||
          [user.id];
        await sendGroupMessage.mutateAsync({
          group_id: targetId,
          group_name: chatInfo.title,
          members: gMembers,
          message: msgText,
          reply_to: replyData,
          expiration_days: expirationDays,
        });
      }
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } catch (e: any) {
      // Restore typed message text on failure so user doesn't lose content
      setInputText(msgText);
      toast({
        variant: 'destructive',
        title: 'Unable to send message',
        description: e.message || 'Please check your connection and try again.',
      });
    }
  };

  const handleCopyText = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Copied to clipboard' });
  };

  return (
    <div className="flex flex-col h-full min-h-0 bg-card/60 relative overflow-hidden">

      {/* ── Conversation Header (fixed, never scrolls) ── */}
      <div className="shrink-0 px-3 sm:px-4 py-3 border-b border-border/80 bg-card/95 backdrop-blur flex items-center justify-between gap-3 z-20 shadow-sm">
        <div className="flex items-center gap-3 min-w-0">
          {onBack && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onBack}
              className="h-8 w-8 rounded-full md:hidden shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
          )}

          {/* Profile Avatar */}
          <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm shrink-0 overflow-hidden border border-primary/20">
            {chatInfo.avatar_url ? (
              <img src={chatInfo.avatar_url} alt={chatInfo.title} className="w-full h-full object-cover" />
            ) : isGroup ? (
              <Users className="w-5 h-5 text-primary" />
            ) : (
              chatInfo.title.charAt(0).toUpperCase()
            )}
          </div>

          <div className="min-w-0">
            <h3 className="text-sm font-bold tracking-tight text-foreground truncate">{chatInfo.title}</h3>
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <span className="truncate">{chatInfo.subtitle}</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" title="Connected" />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {onOpenPollDialog && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onOpenPollDialog}
              className="h-8 w-8 rounded-xl text-primary hover:bg-primary/10"
              title="Create Poll"
            >
              <BarChart2 className="w-4 h-4" />
            </Button>
          )}

          <Button
            variant="ghost"
            size="icon"
            onClick={() => { setShowSearch(!showSearch); if (showSearch) setSearchInChat(''); }}
            className={`h-8 w-8 rounded-xl hover:bg-muted ${showSearch ? 'text-primary bg-primary/10' : 'text-muted-foreground'}`}
            title="Search in conversation"
          >
            <Search className="w-4 h-4" />
          </Button>

          {/* Disappearing messages config */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl text-muted-foreground hover:bg-muted">
                <MoreVertical className="w-4 h-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-2 rounded-2xl" align="end">
              <div className="space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-2 py-1 block">
                  Message Retention
                </span>
                <p className="px-2.5 pb-1.5 text-xs text-muted-foreground">
                  All direct, group and announcement messages are kept for 2 days and then cleaned up automatically.
                </p>

                {isGroup && (chatInfo as any).creator_id === user?.id && (
                  <>
                    <div className="my-1 border-t border-border" />
                    <button
                      onClick={handleDeleteGroup}
                      className="w-full text-left px-2.5 py-1.5 text-xs font-semibold text-destructive rounded-xl hover:bg-destructive/10 flex items-center gap-2"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete Group</span>
                    </button>
                  </>
                )}
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* ── In-chat Search Bar (conditional) ── */}
      {showSearch && (
        <div className="shrink-0 px-3 py-2 bg-muted/40 border-b border-border flex items-center gap-2">
          <Input
            value={searchInChat}
            onChange={(e) => setSearchInChat(e.target.value)}
            placeholder="Search messages..."
            className="h-8 text-xs rounded-xl bg-card flex-1"
            autoFocus
          />
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => { setShowSearch(false); setSearchInChat(''); }}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* ── MESSAGE AREA — Scrollable ── */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 min-h-0 overflow-y-auto px-3 sm:px-4 py-3"
        style={{ scrollbarWidth: 'thin' }}
      >
        {filteredMessages.length === 0 ? (
          <div className="min-h-[200px] flex flex-col items-center justify-center text-center p-6 text-muted-foreground space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-bold text-xl">
              👋
            </div>
            <p className="text-sm font-bold text-foreground">No messages here yet</p>
            <p className="text-xs max-w-xs">Send a message or create a poll to start the conversation!</p>
          </div>
        ) : (
          <div className="space-y-3 pb-2">
            {filteredMessages.map((m) => {
              const isOutgoing = m.sender_id === user?.id;
              const senderProfile = profilesMap.get(m.sender_id);
              const reactions = m.metadata?.reactions || {};
              const reply = m.metadata?.reply_to;

              return (
                <div
                  key={m.id}
                  className={`flex flex-col group ${isOutgoing ? 'items-end' : 'items-start'}`}
                >
                  {/* Sender Name in Group Chat */}
                  {isGroup && !isOutgoing && (
                    <span className="text-[10px] font-bold text-primary mb-1 ml-3">
                      {senderProfile?.full_name || 'Team Member'}
                    </span>
                  )}

                  {/* Message Bubble */}
                  <div
                    className={`max-w-[85%] sm:max-w-[72%] rounded-2xl p-3 shadow-sm relative space-y-1.5 transition-all ${
                      isOutgoing
                        ? 'bg-primary text-primary-foreground rounded-br-sm'
                        : 'bg-card border border-border/80 text-foreground rounded-bl-sm'
                    }`}
                  >
                    {/* Quoted Reply Header */}
                    {reply && (
                      <div className={`p-2 rounded-xl text-xs border-l-2 mb-1.5 ${
                        isOutgoing ? 'bg-primary-foreground/10 border-primary-foreground/40' : 'bg-muted/60 border-primary'
                      }`}>
                        <p className="font-bold text-[10px] uppercase opacity-80">{reply.sender_name || 'Quoted'}</p>
                        <p className="line-clamp-1 italic">{reply.message}</p>
                      </div>
                    )}

                    {/* Poll Content vs Standard Message Body */}
                    {m.metadata?.poll_id ? (
                      <MessengerPollCard pollId={m.metadata.poll_id} />
                    ) : (
                      <ExpandableMessageText text={m.message || ''} />
                    )}

                    {/* Timestamp + Read Checks */}
                    <div className={`flex items-center justify-end gap-1.5 text-[9px] pt-0.5 ${
                      isOutgoing ? 'text-primary-foreground/80' : 'text-muted-foreground'
                    }`}>
                      <span>{format(new Date(m.created_at), 'p')}</span>
                      {isOutgoing && (
                        <span>
                          {m.is_read
                            ? <CheckCheck className="w-3 h-3 text-emerald-300" />
                            : <Check className="w-3 h-3 opacity-70" />
                          }
                        </span>
                      )}
                    </div>

                    {/* Reaction Badges */}
                    {Object.keys(reactions).length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1 pt-1 border-t border-black/10 dark:border-white/10">
                        {Object.entries(reactions).map(([uId, emoji]) => (
                          <span
                            key={uId}
                            onClick={() => toggleReaction.mutate({ message_id: m.id, emoji: emoji as string })}
                            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-background/80 text-[11px] border border-border cursor-pointer shadow-sm hover:scale-110 transition-transform"
                          >
                            {emoji as string}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Hover Context Actions */}
                    <div className={`absolute -top-1 ${isOutgoing ? 'right-full mr-1.5' : 'left-full ml-1.5'} opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 bg-card border border-border shadow-md rounded-xl p-1 z-10`}>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-6 w-6 rounded-lg text-muted-foreground hover:text-foreground">
                            <Smile className="w-3.5 h-3.5" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-1.5 flex gap-1 rounded-2xl" align="center">
                          {EMOJI_LIST.map((e) => (
                            <button
                              key={e}
                              onClick={() => toggleReaction.mutate({ message_id: m.id, emoji: e })}
                              className="text-base hover:scale-125 transition-transform p-1"
                            >
                              {e}
                            </button>
                          ))}
                        </PopoverContent>
                      </Popover>

                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setReplyTarget(m)}
                        className="h-6 w-6 rounded-lg text-muted-foreground hover:text-foreground"
                        title="Reply"
                      >
                        <ReplyIcon className="w-3.5 h-3.5" />
                      </Button>

                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleCopyText(m.message || '')}
                        className="h-6 w-6 rounded-lg text-muted-foreground hover:text-foreground"
                        title="Copy"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </Button>

                      {/* Delete — sender gets "for everyone" option; recipient gets "for me" */}
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 rounded-lg text-muted-foreground hover:text-destructive"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-44 p-1.5 rounded-2xl" align="center">
                          <div className="space-y-0.5">
                            <button
                              onClick={() => deleteMessage.mutate({ message_id: m.id, for_everyone: false })}
                              className="w-full text-left px-2.5 py-1.5 text-xs font-semibold rounded-xl hover:bg-muted"
                            >
                              Delete for me
                            </button>
                            {isOutgoing && (
                              <button
                                onClick={() => deleteMessage.mutate({ message_id: m.id, for_everyone: true })}
                                className="w-full text-left px-2.5 py-1.5 text-xs font-semibold text-destructive rounded-xl hover:bg-destructive/10"
                              >
                                Delete for everyone
                              </button>
                            )}
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* ── New Messages Banner ── */}
      {showNewMsgBanner && (
        <button
          onClick={scrollToBottom}
          className="absolute bottom-[5.5rem] left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-xs font-bold rounded-full shadow-lg hover:bg-primary/90 transition-all animate-bounce-subtle"
        >
          <ChevronDown className="w-3.5 h-3.5" />
          New messages
        </button>
      )}

      {/* ── Quoted Reply Preview Bar ── */}
      {replyTarget && (
        <div className="shrink-0 px-3 py-2 bg-muted/60 border-t border-border flex items-center justify-between gap-2">
          <div className="border-l-2 border-primary pl-2.5 text-xs min-w-0">
            <span className="font-bold text-primary block">
              Replying to {profilesMap.get(replyTarget.sender_id)?.full_name || 'Member'}
            </span>
            <span className="text-muted-foreground line-clamp-1">{replyTarget.message}</span>
          </div>
          <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full shrink-0" onClick={() => setReplyTarget(null)}>
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
      )}

      {/* ── COMPOSER — Always at bottom ── */}
      <div
        className="shrink-0 px-3 pt-2 pb-3 border-t border-border/80 bg-card/95 backdrop-blur space-y-2 z-20"
        style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))' }}
      >
        {/* Formatting Toolbar */}
        <div className="flex items-center gap-1 overflow-x-auto pb-0.5 text-muted-foreground">
          <Button type="button" variant="ghost" size="icon" onClick={() => applyFormat('*')} className="h-7 w-7 rounded-lg shrink-0">
            <Bold className="w-3.5 h-3.5" />
          </Button>
          <Button type="button" variant="ghost" size="icon" onClick={() => applyFormat('_')} className="h-7 w-7 rounded-lg shrink-0">
            <Italic className="w-3.5 h-3.5" />
          </Button>
          <Button type="button" variant="ghost" size="icon" onClick={() => applyFormat('~')} className="h-7 w-7 rounded-lg shrink-0">
            <Strikethrough className="w-3.5 h-3.5" />
          </Button>
          <Button type="button" variant="ghost" size="icon" onClick={() => applyFormat('`')} className="h-7 w-7 rounded-lg shrink-0">
            <Code className="w-3.5 h-3.5" />
          </Button>
          <span className="w-px h-4 bg-border mx-1 shrink-0" />
          <Badge variant="outline" className="text-[10px] px-2 py-0.5 border-primary/20 text-primary font-bold shrink-0">
            2-day retention ⏱
          </Badge>
        </div>

        {/* Input Row */}
        <div className="flex items-center gap-2">
          <Input
            ref={textareaRef}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            placeholder={`Message ${chatInfo.title}...`}
            className="h-10 text-xs sm:text-sm rounded-xl bg-background border-border/80 focus-visible:ring-primary flex-1 min-w-0"
          />

          <Button
            onClick={handleSendMessage}
            disabled={!inputText.trim() || sendDirectMessage.isPending || sendGroupMessage.isPending}
            className="h-10 px-4 rounded-xl text-xs font-bold gap-1.5 shrink-0"
          >
            <Send className="w-4 h-4" />
            <span className="hidden sm:inline">Send</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
