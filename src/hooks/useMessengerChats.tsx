import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { stripWhatsAppFormatting } from '@/components/ui/whatsapp-text';
import { VISIBLE_PROFILE_OR } from '@/lib/profileVisibility';

/** Global Messenger retention: messages are kept for 2 days, then cleaned up. */
export const MESSAGE_RETENTION_DAYS = 2;

export interface ChatMessage {
  id: string;
  sender_id: string;
  recipient_id: string | null;
  /** Top-level group_id (new model) */
  group_id?: string | null;
  /** Top-level group_members (new model) */
  group_members?: string[] | null;
  title: string;
  message: string | null;
  type: 'direct' | 'group' | 'broadcast' | 'poll' | 'info';
  is_read: boolean;
  created_at: string;
  expires_at?: string | null;
  target_audience?: string;
  metadata?: {
    chat_id?: string;
    group_id?: string;
    group_name?: string;
    group_members?: string[];
    group_avatar?: string;
    poll_id?: string;
    expires_at?: string | null;
    reply_to?: {
      id: string;
      title: string;
      message: string;
      sender_name?: string;
    };
    reactions?: Record<string, string>; // userId -> emoji
    broadcast_id?: string;
    expiration_days?: number;
  };
}

export interface ConversationItem {
  chat_id: string;
  type: 'direct' | 'group' | 'broadcast';
  other_user_id?: string;
  group_id?: string;
  creator_id?: string;
  title: string;
  avatar_url?: string | null;
  last_message?: string | null;
  last_message_at: string;
  unread_count: number;
  is_pinned?: boolean;
  is_muted?: boolean;
  members?: string[];
}

export function isBroadcastMessage(m: ChatMessage): boolean {
  if (!m) return false;
  const meta = m.metadata || {};
  const gId = (m as any).group_id || meta.group_id;
  const typeStr = (m.type || '').toLowerCase();
  const audStr = (meta.target_audience || (m as any).target_audience || '').toLowerCase();
  return (
    typeStr === 'broadcast' ||
    typeStr === 'announcement' ||
    gId === 'announcement' ||
    meta.is_broadcast === true ||
    (m as any).is_broadcast === true ||
    ['all', 'members', 'leads'].includes(audStr)
  );
}

// ── Detect which tables/columns are actually available ──
let _tableCapabilities: {
  messengerMessages: boolean;
  messengerConversations: boolean;
  gnMetadata: boolean;
  groupIdColumn: boolean;
  messageUserState: boolean;
} | null = null;

async function detectCapabilities() {
  if (_tableCapabilities) return _tableCapabilities;

  try {
    const [mmRes, mcRes, gnRes, groupIdRes, musRes] = await Promise.all([
      supabase.from('messenger_messages' as any).select('id').limit(1),
      supabase.from('messenger_conversations' as any).select('id').limit(1),
      supabase.from('grouping_notifications').select('id, metadata, expires_at').limit(1),
      supabase.from('messenger_messages' as any).select('id, group_id, group_members').limit(1),
      supabase.from('message_user_state' as any).select('id').limit(1),
    ]);

    _tableCapabilities = {
      messengerMessages: !mmRes.error,
      messengerConversations: !mcRes.error,
      gnMetadata: !gnRes.error,
      groupIdColumn: !groupIdRes.error,
      messageUserState: !musRes.error,
    };
  } catch (e) {
    _tableCapabilities = {
      messengerMessages: true,
      messengerConversations: true,
      gnMetadata: true,
      groupIdColumn: true,
      messageUserState: true,
    };
  }

  console.log('[MESSENGER CAPS]', _tableCapabilities);
  return _tableCapabilities;
}

/** Resolve the members array for a group from the persistent conversation record */
async function resolveGroupMembers(groupId: string, fallback: string[]): Promise<string[]> {
  const { data, error } = await (supabase as any)
    .from('messenger_conversations')
    .select('metadata')
    .eq('id', groupId)
    .single();

  if (!error && data?.metadata?.members?.length > 0) {
    return data.metadata.members as string[];
  }

  return fallback;
}

export function useMessengerChats() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const markReadTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  // Debounce realtime invalidation to prevent duplicate rerenders
  const invalidateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const debouncedInvalidateMessages = useCallback(() => {
    if (invalidateTimer.current) clearTimeout(invalidateTimer.current);
    invalidateTimer.current = setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: ['messenger-messages'] });
    }, 200);
  }, [queryClient]);

  // ── 1. Fetch persistent conversations from messenger_conversations ──
  const conversationsQuery = useQuery({
    queryKey: ['messenger-conversations-raw', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const caps = await detectCapabilities();
      if (!caps.messengerConversations) return [];

      const { data, error } = await (supabase as any)
        .from('messenger_conversations')
        .select('id, creator_id, title, avatar_url, last_message, last_message_at, created_at, metadata, updated_at')
        .order('updated_at', { ascending: false });

      if (error) {
        console.warn('[messenger] messenger_conversations fetch error:', error.message);
        return [];
      }
      return (data || []) as any[];
    },
    enabled: !!user,
    staleTime: 30000,
  });

  // ── 2. Fetch messages (concurrently from messenger_messages AND grouping_notifications) ──
  const messagesQuery = useQuery({
    queryKey: ['messenger-messages', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const caps = await detectCapabilities();

      const fetchPromises: Promise<ChatMessage[]>[] = [];

      // 1. Query messenger_messages
      if (caps.messengerMessages) {
        const selectCols = caps.groupIdColumn
          ? 'id, sender_id, recipient_id, group_id, group_members, title, message, type, is_read, created_at, expires_at, metadata'
          : 'id, sender_id, recipient_id, title, message, type, is_read, created_at, expires_at, metadata';

        fetchPromises.push(
          (async () => {
            const res = await (supabase as any)
              .from('messenger_messages')
              .select(selectCols)
              .order('created_at', { ascending: false })
              .limit(300);

            if (res.error) {
              console.warn('[messenger_messages fetch error]:', res.error.message);
              return [];
            }
            return (res.data || []) as ChatMessage[];
          })()
        );
      }

      // 2. Query grouping_notifications (DO NOT SKIP — contains broadcasts & targeted system notifications)
      fetchPromises.push(
        (async () => {
          const gnSelect = caps.gnMetadata
            ? 'id, sender_id, recipient_id, title, message, type, is_read, created_at, metadata, expires_at'
            : 'id, sender_id, recipient_id, title, message, type, is_read, created_at';

          const gnRes = await supabase
            .from('grouping_notifications')
            .select(gnSelect)
            .or(`recipient_id.eq.${user.id},sender_id.eq.${user.id},is_broadcast.eq.true,type.eq.broadcast`)
            .order('created_at', { ascending: false })
            .limit(200);

          if (gnRes.error) {
            console.warn('[grouping_notifications fetch error]:', gnRes.error.message);
            return [];
          }
          return (gnRes.data || []) as unknown as ChatMessage[];
        })()
      );

      const results = await Promise.all(fetchPromises);
      const combinedRaw = results.flat();

      // Soft delete & expiration filtering
      let hiddenIds = new Set<string>();
      if (caps.messageUserState) {
        const hidRes = await (supabase as any)
          .from('message_user_state')
          .select('message_id')
          .eq('user_id', user.id);

        if (!hidRes.error && hidRes.data) {
          hiddenIds = new Set((hidRes.data as any[]).map((r) => r.message_id));
        }
      }

      const nowIso = new Date().toISOString();
      const messageMap = new Map<string, ChatMessage>();

      combinedRaw.forEach((m) => {
        if (!m || !m.id) return;
        if (hiddenIds.has(m.id)) return;

        // Expiration check (2-day retention)
        const exp = (m as any).expires_at || m.metadata?.expires_at;
        if (exp && new Date(exp).toISOString() <= nowIso) return;

        // Deduplicate by message ID or broadcast_id
        const bId = m.metadata?.broadcast_id;
        const key = bId ? `broadcast_${bId}` : m.id;

        if (!messageMap.has(key)) {
          messageMap.set(key, m);
        }
      });

      return Array.from(messageMap.values()).sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
    },
    enabled: !!user,
    staleTime: 15000,
  });

  // Profiles Query (Cached for 5 minutes)
  const profilesQuery = useQuery({
    queryKey: ['messenger-profiles-map'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, full_name, avatar_url, email, department').or(VISIBLE_PROFILE_OR);
      if (error) throw error;
      const map = new Map<string, { full_name: string; avatar_url?: string | null; email?: string; department?: string }>();
      (data || []).forEach((p) => {
        map.set(p.user_id, {
          full_name: p.full_name || 'Team Member',
          avatar_url: p.avatar_url,
          email: p.email,
          department: p.department,
        });
      });
      return map;
    },
    staleTime: 5 * 60 * 1000,
  });

  // ── 4. Realtime Subscriptions ──
  useEffect(() => {
    if (!user) return;

    const channelName = `messenger-channel-${user.id}`;
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'grouping_notifications' }, () => {
        debouncedInvalidateMessages();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messenger_messages' as any }, () => {
        debouncedInvalidateMessages();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messenger_conversations' as any }, () => {
        queryClient.invalidateQueries({ queryKey: ['messenger-conversations-raw'] });
        debouncedInvalidateMessages();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'message_user_state' as any }, () => {
        debouncedInvalidateMessages();
      })
      .subscribe((status) => {
        console.log('[MESSENGER REALTIME]', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient, debouncedInvalidateMessages]);

  const allMessages = messagesQuery.data || [];
  const profilesMap = profilesQuery.data || new Map();
  const persistentConversations = conversationsQuery.data || [];

  // ── 5. Derive Conversation List (including permanent Announcement broadcast channel) ──
  const conversations = useMemo(() => {
    if (!user) return [];
    const map = new Map<string, ConversationItem>();

    // Seed system Announcement profile conversation (always available)
    const ANNOUNCEMENT_ID = 'broadcast_announcement';
    map.set(ANNOUNCEMENT_ID, {
      chat_id: ANNOUNCEMENT_ID,
      type: 'broadcast',
      title: 'Announcement',
      avatar_url: null,
      last_message: 'Official System Broadcast Channel',
      last_message_at: new Date(0).toISOString(),
      unread_count: 0,
    });

    // Step A: Seed persistent conversations from messenger_conversations table
    persistentConversations.forEach((conv) => {
      const members: string[] = conv.metadata?.members || [];
      // Only include if creator or member
      if (conv.creator_id !== user.id && !members.includes(user.id)) {
        return;
      }

      if (conv.type === 'group') {
        const chatId = `group_${conv.id}`;
        map.set(chatId, {
          chat_id: chatId,
          type: 'group',
          group_id: conv.id,
          creator_id: conv.creator_id,
          title: conv.title || conv.metadata?.group_name || 'Group Chat',
          avatar_url: conv.avatar_url || conv.metadata?.group_avatar || null,
          last_message: conv.last_message || null,
          last_message_at: conv.last_message_at || conv.created_at,
          unread_count: 0,
          members,
        });
      }
    });

    // Step B: Overlay messages data
    allMessages.forEach((m) => {
      const meta = m.metadata || {};
      const resolvedGroupId = (m as any).group_id || meta.group_id;
      const resolvedMembers: string[] = (m as any).group_members || meta.group_members || [];

      // ── System Announcement / Broadcast ──
      if (isBroadcastMessage(m)) {
        const existing = map.get(ANNOUNCEMENT_ID);
        const isUnread = !m.is_read && m.sender_id !== user.id;

        if (existing) {
          if (new Date(m.created_at) > new Date(existing.last_message_at)) {
            existing.last_message = m.message;
            existing.last_message_at = m.created_at;
          }
          if (isUnread) existing.unread_count += 1;
        }
        return;
      }

      // ── Group Chat ──
      if (m.type === 'group' || resolvedGroupId) {
        const gId = resolvedGroupId;
        if (!gId) return;

        // Visibility check: sender or group member
        if (
          m.sender_id !== user.id &&
          !resolvedMembers.includes(user.id)
        ) return;

        const chatId = `group_${gId}`;
        const existing = map.get(chatId);
        // Unread: not from me, and (recipient_id is me OR I'm in group_members)
        const isUnread = !m.is_read && m.sender_id !== user.id;

        if (!existing) {
          map.set(chatId, {
            chat_id: chatId,
            type: 'group',
            group_id: gId,
            title: meta.group_name || m.title || 'Group Chat',
            avatar_url: meta.group_avatar || null,
            last_message: m.message,
            last_message_at: m.created_at,
            unread_count: isUnread ? 1 : 0,
            members: resolvedMembers,
          });
        } else {
          if (new Date(m.created_at) > new Date(existing.last_message_at)) {
            existing.last_message = m.message;
            existing.last_message_at = m.created_at;
          }
          if (isUnread) existing.unread_count += 1;
        }
        return;
      }

      // ── Direct 1-on-1 ──
      const otherUserId = m.sender_id === user.id ? m.recipient_id : m.sender_id;
      if (!otherUserId) return;

      const chatId = `direct_${otherUserId}`;
      const otherProfile = profilesMap.get(otherUserId);
      const isUnread = !m.is_read && m.recipient_id === user.id;

      const existing = map.get(chatId);
      if (!existing) {
        map.set(chatId, {
          chat_id: chatId,
          type: 'direct',
          other_user_id: otherUserId,
          title: otherProfile?.full_name || 'Team Member',
          avatar_url: otherProfile?.avatar_url || null,
          last_message: m.message,
          last_message_at: m.created_at,
          unread_count: isUnread ? 1 : 0,
        });
      } else {
        if (new Date(m.created_at) > new Date(existing.last_message_at)) {
          existing.last_message = m.message;
          existing.last_message_at = m.created_at;
        }
        if (isUnread) existing.unread_count += 1;
      }
    });

    return Array.from(map.values()).sort(
      (a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime()
    );
  }, [allMessages, persistentConversations, user, profilesMap]);

  // ── 6. Send Direct Message ──
  const sendDirectMessage = useMutation({
    mutationFn: async (params: {
      recipient_id: string;
      message: string;
      title?: string;
      type?: 'direct' | 'poll';
      metadata?: ChatMessage['metadata'];
      reply_to?: NonNullable<ChatMessage['metadata']>['reply_to'];
      expiration_days?: number;
    }) => {
      if (!user) throw new Error('Not authenticated');
      const caps = await detectCapabilities();

      const expDays = params.expiration_days ?? MESSAGE_RETENTION_DAYS;
      const expires_at = new Date(Date.now() + expDays * 24 * 60 * 60 * 1000).toISOString();
      const titleText = params.title || 'Direct Message';
      const msgType = params.type || 'direct';
      const metaCombined = {
        reply_to: params.reply_to,
        expiration_days: expDays,
        expires_at,
        ...(params.metadata || {}),
      };

      // Attempt 1: messenger_messages
      if (caps.messengerMessages) {
        const payload = {
          sender_id: user.id,
          recipient_id: params.recipient_id,
          title: titleText,
          message: params.message,
          type: msgType,
          expires_at,
          metadata: metaCombined,
        };

        const res = await (supabase as any).from('messenger_messages').insert(payload).select().single();
        if (!res.error) {
          console.log('[DM] Sent via messenger_messages:', res.data?.id);
          triggerPushNotification(params.recipient_id, user.id, params.message, profilesMap);
          debouncedInvalidateMessages();
          return res.data;
        }
        console.warn('[DM] messenger_messages failed:', res.error.message);
      }

      // Attempt 2: grouping_notifications with metadata
      if (caps.gnMetadata) {
        const payload: any = {
          sender_id: user.id,
          recipient_id: params.recipient_id,
          title: titleText,
          message: params.message,
          type: msgType,
          expires_at,
          metadata: metaCombined,
        };
        const res = await supabase.from('grouping_notifications').insert(payload).select().single();
        if (!res.error) {
          console.log('[DM] Sent via grouping_notifications+metadata:', res.data?.id);
          triggerPushNotification(params.recipient_id, user.id, params.message, profilesMap);
          debouncedInvalidateMessages();
          return res.data;
        }
        console.warn('[DM] grouping_notifications+metadata failed:', res.error.message);
      }

      // Attempt 3: bare grouping_notifications (minimum columns)
      const barePayload = {
        sender_id: user.id,
        recipient_id: params.recipient_id,
        title: titleText,
        message: params.message,
        type: msgType,
      };
      const res3 = await supabase.from('grouping_notifications').insert(barePayload).select().single();
      if (res3.error) {
        throw new Error(res3.error.message || 'Unable to deliver message');
      }
      console.log('[DM] Sent via bare grouping_notifications:', res3.data?.id);
      triggerPushNotification(params.recipient_id, user.id, params.message, profilesMap);
      debouncedInvalidateMessages();
      return res3.data;
    },
    onError: (e: any) => {
      toast({
        variant: 'destructive',
        title: 'Unable to send message',
        description: e.message || 'Please check your connection and try again.',
      });
    },
  });

  // ── Helper: fire push notification asynchronously ──
  const triggerPushNotification = async (
    recipientId: string,
    senderId: string,
    messageText: string,
    pMap: Map<string, any>
  ) => {
    try {
      const cleanBody = stripWhatsAppFormatting(messageText);
      const senderName = pMap.get(senderId)?.full_name || 'Messenger';
      await supabase.functions.invoke('send-push', {
        body: {
          user_ids: [recipientId],
          title: senderName,
          body: cleanBody,
          data: { path: '/grouping/notifications', chat_id: `direct_${senderId}` },
        },
      });
      console.log('[PUSH] Direct push sent to', recipientId);
    } catch (e) {
      console.warn('[PUSH ERROR] Push notification failed (non-critical):', e);
    }
  };

  // ── 7. Send Group Message — SINGLE ROW MODEL ──
  const sendGroupMessage = useMutation({
    mutationFn: async (params: {
      group_id: string;
      group_name: string;
      members: string[];
      message: string;
      title?: string;
      type?: 'group' | 'poll';
      metadata?: ChatMessage['metadata'];
      reply_to?: NonNullable<ChatMessage['metadata']>['reply_to'];
      expiration_days?: number;
    }) => {
      if (!user) throw new Error('Not authenticated');
      const caps = await detectCapabilities();

      // Always resolve members from the persistent conversation record
      // This guarantees correct member list even when no prior messages exist
      const resolvedMembers = await resolveGroupMembers(params.group_id, params.members);
      const recipients = resolvedMembers.filter((id) => id !== user.id);
      const allMembers = resolvedMembers.includes(user.id)
        ? resolvedMembers
        : [user.id, ...resolvedMembers];

      const expDays = params.expiration_days ?? MESSAGE_RETENTION_DAYS;
      const expires_at = new Date(Date.now() + expDays * 24 * 60 * 60 * 1000).toISOString();
      const msgType = params.type || 'group';

      console.log('[GROUP MESSAGE] Sending to group', params.group_id, 'members:', allMembers);

      // Update messenger_conversations last_message & last_message_at
      if (caps.messengerConversations) {
        await (supabase as any)
          .from('messenger_conversations')
          .update({
            last_message: params.message,
            last_message_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', params.group_id);
      }

      // Attempt 1: messenger_messages — SINGLE ROW (new group model)
      if (caps.messengerMessages && caps.groupIdColumn) {
        const singleRow = {
          sender_id: user.id,
          recipient_id: null,          // NULL for group messages
          group_id: params.group_id,   // top-level column
          group_members: allMembers,   // top-level UUID array
          title: params.title || params.group_name,
          message: params.message,
          type: msgType,
          expires_at,
          metadata: {
            group_id: params.group_id,
            group_name: params.group_name,
            group_members: allMembers,
            reply_to: params.reply_to,
            expiration_days: expDays,
            expires_at,
            ...(params.metadata || {}),
          },
        };

        const res = await (supabase as any).from('messenger_messages').insert(singleRow).select().single();
        if (!res.error) {
          console.log('[GROUP MESSAGE] Sent as single row via messenger_messages:', res.data?.id);
          triggerGroupPush(recipients, params.group_name, user.id, params.message, params.group_id, profilesMap);
          queryClient.invalidateQueries({ queryKey: ['messenger-conversations-raw'] });
          debouncedInvalidateMessages();
          return res.data;
        }
        console.warn('[GROUP MESSAGE] single-row insert failed:', res.error.message);
      }

      // Attempt 2: messenger_messages multi-row (old model, no group_id column)
      if (caps.messengerMessages && !caps.groupIdColumn && recipients.length > 0) {
        const rows = recipients.map((rId) => ({
          sender_id: user.id,
          recipient_id: rId,
          title: params.title || params.group_name,
          message: params.message,
          type: msgType,
          expires_at,
          metadata: {
            group_id: params.group_id,
            group_name: params.group_name,
            group_members: allMembers,
            reply_to: params.reply_to,
            expiration_days: expDays,
            expires_at,
            ...(params.metadata || {}),
          },
        }));
        const res = await (supabase as any).from('messenger_messages').insert(rows);
        if (!res.error) {
          console.log('[GROUP MESSAGE] Sent via multi-row messenger_messages');
          triggerGroupPush(recipients, params.group_name, user.id, params.message, params.group_id, profilesMap);
          queryClient.invalidateQueries({ queryKey: ['messenger-conversations-raw'] });
          debouncedInvalidateMessages();
          return;
        }
        console.warn('[GROUP MESSAGE] multi-row insert failed:', res.error.message);
      }

      // Attempt 3: grouping_notifications with metadata (multi-row fallback)
      if (caps.gnMetadata && recipients.length > 0) {
        const rows = recipients.map((rId) => ({
          sender_id: user.id,
          recipient_id: rId,
          title: params.title || params.group_name,
          message: params.message,
          type: msgType,
          expires_at,
          metadata: {
            group_id: params.group_id,
            group_name: params.group_name,
            group_members: allMembers,
            reply_to: params.reply_to,
            expiration_days: expDays,
            expires_at,
            ...(params.metadata || {}),
          },
        }));

        const res = await supabase.from('grouping_notifications').insert(rows as any);
        if (!res.error) {
          console.log('[GROUP MESSAGE] Sent via grouping_notifications+metadata');
          triggerGroupPush(recipients, params.group_name, user.id, params.message, params.group_id, profilesMap);
          queryClient.invalidateQueries({ queryKey: ['messenger-conversations-raw'] });
          debouncedInvalidateMessages();
          return;
        }
        console.warn('[GROUP MESSAGE] grouping_notifications+metadata failed:', res.error.message);
        throw new Error(res.error.message || 'Failed to send group message');
      }

      if (recipients.length === 0) {
        console.warn('[GROUP MESSAGE] No recipients — group has only the sender');
      }
    },
    onError: (e: any) => {
      toast({
        variant: 'destructive',
        title: 'Unable to send message',
        description: e.message || 'Please try again.',
      });
    },
  });

  const triggerGroupPush = async (
    recipients: string[],
    groupName: string,
    senderId: string,
    messageText: string,
    groupId: string,
    pMap: Map<string, any>
  ) => {
    if (recipients.length === 0) return;
    try {
      const cleanBody = stripWhatsAppFormatting(messageText);
      const senderName = pMap.get(senderId)?.full_name || 'Someone';
      await supabase.functions.invoke('send-push', {
        body: {
          user_ids: recipients,
          title: `${groupName}: ${senderName}`,
          body: cleanBody,
          data: { path: '/grouping/notifications', chat_id: `group_${groupId}` },
        },
      });
      console.log('[GROUP PUSH] Sent to', recipients.length, 'recipients for group', groupId);
    } catch (e) {
      console.warn('[GROUP PUSH ERROR] (non-critical):', e);
    }
  };

  // ── 8. Delete Group Conversation ──
  const deleteGroup = useMutation({
    mutationFn: async (groupId: string) => {
      if (!user) throw new Error('Not authenticated');
      const caps = await detectCapabilities();

      if (caps.messengerConversations) {
        const { error } = await (supabase as any)
          .from('messenger_conversations')
          .delete()
          .eq('id', groupId);
        if (error) throw error;
      }

      // Clean up messages for this group
      if (caps.messengerMessages) {
        if (caps.groupIdColumn) {
          await (supabase as any)
            .from('messenger_messages')
            .delete()
            .eq('group_id', groupId);
        } else {
          await (supabase as any)
            .from('messenger_messages')
            .delete()
            .filter('metadata->>group_id', 'eq', groupId);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messenger-conversations-raw'] });
      debouncedInvalidateMessages();
      toast({ title: 'Group Deleted', description: 'The group conversation has been deleted.' });
    },
    onError: (e: any) => {
      toast({ variant: 'destructive', title: 'Failed to delete group', description: e.message });
    },
  });

  // ── 9. Toggle Reaction ──
  const toggleReaction = useMutation({
    mutationFn: async (params: { message_id: string; emoji: string }) => {
      if (!user) return;
      const caps = await detectCapabilities();

      const msg = allMessages.find((m) => m.id === params.message_id);
      if (!msg) return;

      const currentReactions = { ...(msg.metadata?.reactions || {}) };
      if (currentReactions[user.id] === params.emoji) {
        delete currentReactions[user.id];
      } else {
        currentReactions[user.id] = params.emoji;
      }

      const updatedMeta = { ...(msg.metadata || {}), reactions: currentReactions };

      if (caps.messengerMessages) {
        const res = await (supabase as any)
          .from('messenger_messages')
          .update({ metadata: updatedMeta })
          .eq('id', params.message_id);
        if (!res.error) return;
      }

      if (caps.gnMetadata) {
        await supabase
          .from('grouping_notifications')
          .update({ metadata: updatedMeta } as any)
          .eq('id', params.message_id);
      }
    },
    onSuccess: () => {
      debouncedInvalidateMessages();
    },
  });

  // ── 10. Delete Message (WhatsApp style) ──
  const deleteMessage = useMutation({
    mutationFn: async (params: { message_id: string; for_everyone?: boolean }) => {
      if (!user) throw new Error('Not authenticated');
      const caps = await detectCapabilities();
      const msgId = typeof params === 'string' ? params : params.message_id;
      const forEveryone = typeof params === 'string' ? false : (params.for_everyone ?? false);

      const msg = allMessages.find((m) => m.id === msgId);
      const isSender = msg?.sender_id === user.id;

      // Hard delete for sender who chooses "delete for everyone"
      if (isSender && forEveryone) {
        if (caps.messengerMessages) {
          const { error } = await (supabase as any)
            .from('messenger_messages')
            .delete()
            .eq('id', msgId);
          if (!error) return;
        }
        await supabase.from('grouping_notifications').delete().eq('id', msgId);
        return;
      }

      // Soft delete: record hidden state only for this user
      if (caps.messageUserState) {
        const { error } = await (supabase as any)
          .from('message_user_state')
          .upsert({ message_id: msgId, user_id: user.id, hidden_at: new Date().toISOString() });
        if (!error) return;
      }

      // Fallback: hard delete (old behavior if message_user_state table not available)
      if (caps.messengerMessages) {
        const { error } = await (supabase as any)
          .from('messenger_messages')
          .delete()
          .eq('id', msgId);
        if (!error) return;
      }
      await supabase.from('grouping_notifications').delete().eq('id', msgId);
    },
    onSuccess: () => {
      debouncedInvalidateMessages();
      toast({ title: 'Message Deleted' });
    },
    onError: (e: any) => {
      toast({ variant: 'destructive', title: 'Failed to delete message', description: e.message });
    },
  });

  // ── 11. Mark Conversation as Read (debounced) ──
  const markConversationAsRead = useCallback((chatId: string) => {
    if (!user) return;

    if (markReadTimers.current[chatId]) {
      clearTimeout(markReadTimers.current[chatId]);
    }

    markReadTimers.current[chatId] = setTimeout(async () => {
      const unreadMsgs = allMessages.filter((m) => {
        if (m.is_read) return false;
        // For group messages: not sent by me and I'm a member
        if (chatId.startsWith('group_')) {
          const gId = chatId.replace('group_', '');
          const resolvedGroupId = (m as any).group_id || m.metadata?.group_id;
          return resolvedGroupId === gId && m.sender_id !== user.id;
        }
        // For direct messages
        if (chatId.startsWith('direct_')) {
          if (m.recipient_id !== user.id) return false;
          const otherId = chatId.replace('direct_', '');
          return m.sender_id === otherId;
        }
        return false;
      });

      if (unreadMsgs.length === 0) return;
      const ids = unreadMsgs.map((m) => m.id);

      // Try both tables
      await (supabase as any).from('messenger_messages').update({ is_read: true }).in('id', ids);
      await supabase.from('grouping_notifications').update({ is_read: true }).in('id', ids);

      debouncedInvalidateMessages();
    }, 500);
  }, [user, allMessages, debouncedInvalidateMessages]);

  // ── 12. Send Announcement / Broadcast Message ──
  const sendBroadcastMessage = useMutation({
    mutationFn: async (params: {
      message: string;
      title?: string;
      recipients?: string[];
      metadata?: ChatMessage['metadata'];
      expiration_days?: number;
    }) => {
      if (!user) throw new Error('Not authenticated');
      const caps = await detectCapabilities();

      const expDays = params.expiration_days ?? MESSAGE_RETENTION_DAYS;
      const expires_at = new Date(Date.now() + expDays * 24 * 60 * 60 * 1000).toISOString();
      const titleText = params.title || 'Announcement';
      const metaCombined = {
        is_broadcast: true,
        sender_name: 'Announcement',
        broadcast_id: crypto.randomUUID(),
        expiration_days: expDays,
        expires_at,
        ...(params.metadata || {}),
      };

      let resultData: any = null;

      if (caps.messengerMessages) {
        const payload = {
          sender_id: user.id,
          recipient_id: null,
          group_id: 'announcement',
          title: titleText,
          message: params.message,
          type: 'broadcast',
          expires_at,
          metadata: metaCombined,
        };

        const res = await (supabase as any).from('messenger_messages').insert(payload).select().single();
        if (!res.error) {
          resultData = res.data;
        } else {
          console.warn('[ANNOUNCEMENT] messenger_messages insert error:', res.error.message);
        }
      }

      if (!resultData) {
        const gnPayload = {
          sender_id: user.id,
          recipient_id: user.id,
          title: titleText,
          message: params.message,
          type: 'broadcast',
          is_broadcast: true,
          expires_at,
          metadata: metaCombined,
        };
        const res = await supabase.from('grouping_notifications').insert(gnPayload as any).select().single();
        if (res.error) throw new Error(res.error.message || 'Failed to send announcement');
        resultData = res.data;
      }

      triggerAnnouncementPush(params.recipients || [], titleText, params.message);
      debouncedInvalidateMessages();
      return resultData;
    },
    onError: (e: any) => {
      toast({
        variant: 'destructive',
        title: 'Unable to send announcement',
        description: e.message || 'Please check permissions.',
      });
    },
  });

  const triggerAnnouncementPush = async (
    recipients: string[],
    titleText: string,
    messageText: string
  ) => {
    try {
      const cleanBody = stripWhatsAppFormatting(messageText);
      await supabase.functions.invoke('send-push', {
        body: {
          user_ids: recipients.length > 0 ? recipients : undefined,
          title: `Announcement: ${titleText}`,
          body: cleanBody,
          data: {
            path: '/grouping/notifications?chat_id=broadcast_announcement',
            chat_id: 'broadcast_announcement',
          },
        },
      });
      console.log('[ANNOUNCEMENT PUSH] Triggered push to active recipients');
    } catch (e) {
      console.warn('[ANNOUNCEMENT PUSH ERROR]:', e);
    }
  };

  const allProfiles = useMemo(() => {
    return Array.from(profilesMap.entries()).map(([userId, p]) => ({
      user_id: userId,
      full_name: p.full_name,
      avatar_url: p.avatar_url,
      email: p.email,
      department: p.department,
    }));
  }, [profilesMap]);

  return {
    messages: allMessages,
    conversations,
    profilesMap,
    allProfiles,
    isLoading: messagesQuery.isLoading,
    sendDirectMessage,
    sendGroupMessage,
    sendBroadcastMessage,
    deleteGroup,
    toggleReaction,
    deleteMessage,
    markConversationAsRead,
    refetch: messagesQuery.refetch,
  };
}
