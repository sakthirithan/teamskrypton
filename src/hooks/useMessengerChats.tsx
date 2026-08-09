import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { stripWhatsAppFormatting } from '@/components/ui/whatsapp-text';

export interface ChatMessage {
  id: string;
  sender_id: string;
  recipient_id: string;
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

// ── Detect which tables/columns are actually available ──
let _tableCapabilities: {
  messengerMessages: boolean;
  messengerConversations: boolean;
  gnMetadata: boolean;
  gnExpiresAt: boolean;
} | null = null;

async function detectCapabilities() {
  if (_tableCapabilities) return _tableCapabilities;

  const [mmRes, mcRes, gnRes] = await Promise.all([
    supabase.from('messenger_messages' as any).select('id').limit(1),
    supabase.from('messenger_conversations' as any).select('id').limit(1),
    supabase.from('grouping_notifications').select('id, metadata, expires_at').limit(1),
  ]);

  _tableCapabilities = {
    messengerMessages: !mmRes.error,
    messengerConversations: !mcRes.error,
    gnMetadata: !gnRes.error,
    gnExpiresAt: !gnRes.error,
  };

  console.log('[MESSENGER CAPS]', _tableCapabilities);
  return _tableCapabilities;
}

export function useMessengerChats() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const markReadTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // ── 1. Fetch persistent conversations from messenger_conversations ──
  const conversationsQuery = useQuery({
    queryKey: ['messenger-conversations-raw', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const caps = await detectCapabilities();
      if (!caps.messengerConversations) return [];

      const { data, error } = await supabase
        .from('messenger_conversations' as any)
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) {
        console.warn('[messenger] messenger_conversations fetch error:', error.message);
        return [];
      }
      return (data || []) as any[];
    },
    enabled: !!user,
    staleTime: 5000,
  });

  // ── 2. Fetch messages ──
  const messagesQuery = useQuery({
    queryKey: ['messenger-messages', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const caps = await detectCapabilities();
      const nowIso = new Date().toISOString();

      let rawMessages: ChatMessage[] = [];

      // Attempt 1: messenger_messages table
      if (caps.messengerMessages) {
        const res = await supabase
          .from('messenger_messages' as any)
          .select('*')
          .or(`recipient_id.eq.${user.id},sender_id.eq.${user.id}`)
          .order('created_at', { ascending: false })
          .limit(300);

        if (!res.error && res.data && res.data.length > 0) {
          rawMessages = res.data as unknown as ChatMessage[];
        }
      }

      // Attempt 2: grouping_notifications
      if (rawMessages.length === 0) {
        const gnSelect = caps.gnMetadata
          ? 'id, sender_id, recipient_id, title, message, type, is_read, created_at, metadata, expires_at'
          : 'id, sender_id, recipient_id, title, message, type, is_read, created_at';

        const gnRes = await supabase
          .from('grouping_notifications')
          .select(gnSelect)
          .or(`recipient_id.eq.${user.id},sender_id.eq.${user.id}`)
          .order('created_at', { ascending: false })
          .limit(300);

        if (!gnRes.error && gnRes.data) {
          rawMessages = gnRes.data as unknown as ChatMessage[];
        }
      }

      // Deduplicate messages by ID & filter expired
      const messageMap = new Map<string, ChatMessage>();
      rawMessages.forEach((m) => {
        const exp = (m as any).expires_at || m.metadata?.expires_at;
        if (exp && new Date(exp).toISOString() <= nowIso) return;
        if (!messageMap.has(m.id)) {
          messageMap.set(m.id, m);
        }
      });

      return Array.from(messageMap.values()).reverse();
    },
    enabled: !!user,
    staleTime: 3000,
  });

  // ── 3. Fetch User Profiles ──
  const profilesQuery = useQuery({
    queryKey: ['messenger-profiles-map'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, full_name, avatar_url, email, department');
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
    staleTime: 60000,
  });

  // ── 4. Realtime Subscriptions ──
  useEffect(() => {
    if (!user) return;

    const channelName = `messenger-channel-${user.id}`;
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'grouping_notifications' }, () => {
        queryClient.invalidateQueries({ queryKey: ['messenger-messages'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messenger_messages' as any }, () => {
        queryClient.invalidateQueries({ queryKey: ['messenger-messages'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messenger_conversations' as any }, () => {
        queryClient.invalidateQueries({ queryKey: ['messenger-conversations-raw'] });
        queryClient.invalidateQueries({ queryKey: ['messenger-messages'] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);

  const allMessages = messagesQuery.data || [];
  const profilesMap = profilesQuery.data || new Map();
  const persistentConversations = conversationsQuery.data || [];

  // ── 5. Derive Conversation List (including persistent groups with 0 messages) ──
  const conversations = useMemo(() => {
    if (!user) return [];
    const map = new Map<string, ConversationItem>();

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

      // ── Group Chat ──
      if (m.type === 'group' || meta.group_id) {
        const gId = meta.group_id;
        if (!gId) return;

        const members = meta.group_members || [];
        if (m.sender_id !== user.id && m.recipient_id !== user.id && !members.includes(user.id)) {
          return;
        }

        const chatId = `group_${gId}`;
        const existing = map.get(chatId);
        const isUnread = !m.is_read && m.recipient_id === user.id;

        if (!existing) {
          map.set(chatId, {
            chat_id: chatId,
            type: 'group',
            group_id: gId,
            title: meta.group_name || 'Group Chat',
            avatar_url: meta.group_avatar || null,
            last_message: m.message,
            last_message_at: m.created_at,
            unread_count: isUnread ? 1 : 0,
            members,
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

      const expDays = params.expiration_days ?? 1;
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

        const res = await supabase.from('messenger_messages' as any).insert(payload).select().single();
        if (!res.error) {
          console.log('[DM] Sent via messenger_messages:', res.data?.id);
          triggerPushNotification(params.recipient_id, user.id, params.message, profilesMap);
          queryClient.invalidateQueries({ queryKey: ['messenger-messages'] });
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
          queryClient.invalidateQueries({ queryKey: ['messenger-messages'] });
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
      queryClient.invalidateQueries({ queryKey: ['messenger-messages'] });
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
    } catch (e) {
      console.warn('[PUSH ERROR] Push notification failed (non-critical):', e);
    }
  };

  // ── 7. Send Group Message ──
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

      const expDays = params.expiration_days ?? 1;
      const expires_at = new Date(Date.now() + expDays * 24 * 60 * 60 * 1000).toISOString();
      const recipients = params.members.filter((id) => id !== user.id);
      const msgType = params.type || 'group';

      if (recipients.length === 0) return;

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
          group_members: params.members,
          reply_to: params.reply_to,
          expiration_days: expDays,
          expires_at,
          ...(params.metadata || {}),
        },
      }));

      // Update messenger_conversations last_message & last_message_at if table exists
      if (caps.messengerConversations) {
        await supabase
          .from('messenger_conversations' as any)
          .update({
            last_message: params.message,
            last_message_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', params.group_id);
      }

      // Attempt 1: messenger_messages
      if (caps.messengerMessages) {
        const res = await supabase.from('messenger_messages' as any).insert(rows);
        if (!res.error) {
          console.log('[GROUP] Sent via messenger_messages');
          triggerGroupPush(recipients, params.group_name, user.id, params.message, params.group_id, profilesMap);
          queryClient.invalidateQueries({ queryKey: ['messenger-messages'] });
          queryClient.invalidateQueries({ queryKey: ['messenger-conversations-raw'] });
          return;
        }
        console.warn('[GROUP] messenger_messages failed:', res.error.message);
      }

      // Attempt 2: grouping_notifications with metadata
      if (caps.gnMetadata) {
        const res = await supabase.from('grouping_notifications').insert(rows as any);
        if (!res.error) {
          console.log('[GROUP] Sent via grouping_notifications+metadata');
          triggerGroupPush(recipients, params.group_name, user.id, params.message, params.group_id, profilesMap);
          queryClient.invalidateQueries({ queryKey: ['messenger-messages'] });
          queryClient.invalidateQueries({ queryKey: ['messenger-conversations-raw'] });
          return;
        }
        console.warn('[GROUP] grouping_notifications+metadata failed:', res.error.message);
      }

      // Attempt 3: bare grouping_notifications
      const bareRows = rows.map(({ expires_at: _exp, metadata: _meta, ...rest }) => rest);
      const res3 = await supabase.from('grouping_notifications').insert(bareRows as any);
      if (res3.error) throw new Error(res3.error.message || 'Failed to send group message');

      console.log('[GROUP] Sent via bare grouping_notifications');
      triggerGroupPush(recipients, params.group_name, user.id, params.message, params.group_id, profilesMap);
      queryClient.invalidateQueries({ queryKey: ['messenger-messages'] });
      queryClient.invalidateQueries({ queryKey: ['messenger-conversations-raw'] });
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
        const { error } = await supabase
          .from('messenger_conversations' as any)
          .delete()
          .eq('id', groupId);
        if (error) throw error;
      }

      // Also clean up messenger_messages or grouping_notifications for this group
      if (caps.messengerMessages) {
        await supabase
          .from('messenger_messages' as any)
          .delete()
          .filter('metadata->>group_id', 'eq', groupId);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messenger-conversations-raw'] });
      queryClient.invalidateQueries({ queryKey: ['messenger-messages'] });
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
        const res = await supabase
          .from('messenger_messages' as any)
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
      queryClient.invalidateQueries({ queryKey: ['messenger-messages'] });
    },
  });

  // ── 10. Delete Message ──
  const deleteMessage = useMutation({
    mutationFn: async (messageId: string) => {
      const res1 = await supabase
        .from('messenger_messages' as any)
        .delete()
        .eq('id', messageId);

      if (res1.error) {
        await supabase
          .from('grouping_notifications')
          .delete()
          .eq('id', messageId);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messenger-messages'] });
      toast({ title: 'Message Deleted' });
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
        if (m.is_read || m.recipient_id !== user.id) return false;
        if (chatId.startsWith('direct_')) {
          const otherId = chatId.replace('direct_', '');
          return m.sender_id === otherId;
        }
        if (chatId.startsWith('group_')) {
          const gId = chatId.replace('group_', '');
          return m.metadata?.group_id === gId;
        }
        return false;
      });

      if (unreadMsgs.length === 0) return;
      const ids = unreadMsgs.map((m) => m.id);

      // Try both tables
      await supabase.from('messenger_messages' as any).update({ is_read: true }).in('id', ids);
      await supabase.from('grouping_notifications').update({ is_read: true }).in('id', ids);

      queryClient.invalidateQueries({ queryKey: ['messenger-messages'] });
    }, 500);
  }, [user, allMessages, queryClient]);

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
    deleteGroup,
    toggleReaction,
    deleteMessage,
    markConversationAsRead,
    refetch: messagesQuery.refetch,
  };
}
