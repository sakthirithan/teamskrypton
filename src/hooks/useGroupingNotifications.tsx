import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Badge } from '@capawesome/capacitor-badge';
import { stripWhatsAppFormatting } from '@/components/ui/whatsapp-text';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';

export interface GroupingNotification {
  id: string;
  session_id: string | null;
  sender_id: string;
  recipient_id: string;
  title: string;
  message: string | null;
  type: string;
  is_read: boolean;
  created_at: string;
  target_audience?: 'all' | 'members' | 'leads' | 'direct';
  expires_at?: string | null;
  is_broadcast?: boolean;
  metadata?: Record<string, any>;
}

export interface BroadcastRecipientStatus {
  recipient_id: string;
  is_read: boolean;
  created_at: string;
}

export interface SentBroadcastGroup {
  broadcast_id: string;
  title: string;
  message: string | null;
  type: string;
  created_at: string;
  expires_at?: string | null;
  target_audience?: string;
  is_24h_broadcast?: boolean;
  recipients: BroadcastRecipientStatus[];
  total_recipients: number;
  read_count: number;
}

export function useGroupingNotifications() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const notificationsQuery = useQuery({
    queryKey: ['grouping-notifications', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('grouping_notifications')
        .select('*')
        .eq('recipient_id', user!.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Filter out expired notifications based on original created_at or expires_at
      const nowMs = Date.now();
      const validNotifs = ((data || []) as GroupingNotification[]).filter((n) => {
        if (n.expires_at) {
          if (new Date(n.expires_at).getTime() <= nowMs) return false;
        }
        const expHours = (n.metadata as any)?.expiry_hours || (n.metadata as any)?.expiryHours;
        if (expHours && typeof expHours === 'number') {
          const createdAtMs = new Date(n.created_at).getTime();
          if (createdAtMs + expHours * 3600000 <= nowMs) return false;
        } else if (n.type === 'daily_survey_alert' || n.type === 'general_requirement_alert' || n.type === 'broadcast') {
          // Default 24-hour disappearance period for alert/broadcast notifications
          const createdAtMs = new Date(n.created_at).getTime();
          if (createdAtMs + 24 * 3600000 <= nowMs) return false;
        }
        return true;
      });

      return validNotifs;
    },
    enabled: !!user,
  });

  // Creator's Sent Broadcasts Query (Grouped by broadcast_id)
  const sentBroadcastsQuery = useQuery({
    queryKey: ['sent-broadcasts', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('grouping_notifications')
        .select('*')
        .eq('sender_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const nowMs = Date.now();
      const valid = ((data || []) as GroupingNotification[]).filter((n) => {
        if (n.expires_at) {
          if (new Date(n.expires_at).getTime() <= nowMs) return false;
        }
        const expHours = (n.metadata as any)?.expiry_hours || (n.metadata as any)?.expiryHours;
        if (expHours && typeof expHours === 'number') {
          const createdAtMs = new Date(n.created_at).getTime();
          if (createdAtMs + expHours * 3600000 <= nowMs) return false;
        } else if (n.type === 'daily_survey_alert' || n.type === 'general_requirement_alert' || n.type === 'broadcast') {
          const createdAtMs = new Date(n.created_at).getTime();
          if (createdAtMs + 24 * 3600000 <= nowMs) return false;
        }
        return true;
      });

      const map = new Map<string, SentBroadcastGroup>();

      valid.forEach((n) => {
        const bId = (n.metadata as any)?.broadcast_id || `${n.title}-${n.created_at}`;
        if (!map.has(bId)) {
          map.set(bId, {
            broadcast_id: bId,
            title: n.title,
            message: n.message,
            type: n.type,
            created_at: n.created_at,
            expires_at: n.expires_at,
            target_audience: n.target_audience,
            is_24h_broadcast: !!n.expires_at || n.is_broadcast,
            recipients: [],
            total_recipients: 0,
            read_count: 0,
          });
        }

        const group = map.get(bId)!;
        group.recipients.push({
          recipient_id: n.recipient_id,
          is_read: n.is_read,
          created_at: n.created_at,
        });
        group.total_recipients += 1;
        if (n.is_read) group.read_count += 1;
      });

      return Array.from(map.values());
    },
    enabled: !!user,
  });

  const unreadCount = (notificationsQuery.data || []).filter(n => !n.is_read).length;

  // Update App Icon Badge whenever unreadCount changes
  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      Badge.set({ count: unreadCount }).catch(console.error);
    }
  }, [unreadCount]);

  // Real-time listener and Permission requester
  useEffect(() => {
    const requestPermissions = async () => {
      try {
        if (Capacitor.isNativePlatform()) {
          const check = await LocalNotifications.checkPermissions();
          if (check.display !== 'granted') {
            await LocalNotifications.requestPermissions();
          }
        } else if ('Notification' in window && Notification.permission === 'default') {
          Notification.requestPermission();
        }
      } catch (error) {
        console.error('Error requesting notification permissions:', error);
      }
    };

    requestPermissions();
  }, []);

  useRealtimeSubscription({
    channelName: 'grouping-notifications',
    table: 'grouping_notifications',
    filter: user ? `recipient_id=eq.${user.id}` : undefined,
    event: 'INSERT',
    enabled: !!user,
    onPayload: async (payload) => {
      const newNotif = payload.new as GroupingNotification;
      
      // Update local query cache directly
      queryClient.setQueryData<GroupingNotification[]>(
        ['grouping-notifications', user?.id],
        (old = []) => [newNotif, ...old]
      );
      
      queryClient.invalidateQueries({ queryKey: ['grouping-notifications', user?.id] });
      
      // Display foreground system notification
      try {
        const cleanBody = stripWhatsAppFormatting(newNotif.message || '');
        if (Capacitor.isNativePlatform()) {
          await LocalNotifications.schedule({
            notifications: [
              {
                title: newNotif.title,
                body: cleanBody,
                id: Math.floor(Math.random() * 100000),
                schedule: { at: new Date(Date.now() + 100) },
              }
            ]
          });
        } else if ('Notification' in window && Notification.permission === 'granted') {
          new Notification(newNotif.title, {
            body: cleanBody,
          });
        }
      } catch (error) {
        console.error('Error scheduling notification', error);
      }
    },
  });

  // Original single recipient send
  const sendNotification = useMutation({
    mutationFn: async (params: {
      recipient_id: string;
      title: string;
      message?: string;
      type?: string;
      session_id?: string;
    }) => {
      const broadcast_id = crypto.randomUUID();
      const { data, error } = await supabase
        .from('grouping_notifications')
        .insert({
          sender_id: user!.id,
          recipient_id: params.recipient_id,
          title: params.title,
          message: params.message || null,
          type: params.type || 'info',
          session_id: params.session_id || null,
          metadata: { broadcast_id, target_audience: 'direct', recipient_count: 1 },
        } as any)
        .select()
        .single();

      if (error) throw error;

      // Trigger background FCM push via Edge Function
      try {
        const cleanBody = stripWhatsAppFormatting(params.message || '');
        await supabase.functions.invoke('send-push', {
          body: {
            user_ids: [params.recipient_id],
            title: params.title,
            body: cleanBody,
            data: { path: '/grouping/notifications' },
          },
        });
      } catch (err) {
        console.warn('FCM push invoke error:', err);
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grouping-notifications'] });
      queryClient.invalidateQueries({ queryKey: ['sent-broadcasts'] });
      toast({ title: 'Notification Sent' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // Private multi-recipient broadcast send (Individual DB rows, Creator broadcast grouping)
  const sendTargetedNotification = useMutation({
    mutationFn: async (params: {
      recipient_ids: string[];
      target_audience: 'all' | 'members' | 'leads' | 'direct';
      title: string;
      message: string;
      type?: string;
      is_24h_broadcast?: boolean;
      session_id?: string;
    }) => {
      if (!user) throw new Error('Not authenticated');
      if (params.recipient_ids.length === 0) throw new Error('No recipients selected');

      const broadcast_id = crypto.randomUUID();
      const expTimestamp = params.is_24h_broadcast
        ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        : new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();

      const rows = params.recipient_ids.map((recipient_id) => ({
        sender_id: user.id,
        recipient_id,
        title: params.title,
        message: params.message,
        type: 'broadcast',
        session_id: params.session_id || null,
        target_audience: params.target_audience,
        expires_at: expTimestamp,
        is_broadcast: true,
        metadata: {
          broadcast_id,
          target_audience: params.target_audience,
          recipient_count: params.recipient_ids.length,
          is_broadcast: true,
          sender_name: 'Announcement',
          group_id: 'announcement',
        },
      }));

      let { error } = await supabase.from('grouping_notifications').insert(rows as any);
      if (error && error.message?.includes('expires_at')) {
        console.warn('[notifications] PostgREST schema cache fallback for expires_at. Retrying base insert...');
        const fallbackRows = rows.map(({ expires_at, target_audience, is_broadcast, metadata, ...rest }) => rest);
        const retry = await supabase.from('grouping_notifications').insert(fallbackRows as any);
        error = retry.error;
      }
      if (error) throw error;

      // Dual persist to messenger_messages for Messenger alignment
      try {
        await (supabase as any).from('messenger_messages').insert({
          sender_id: user.id,
          recipient_id: null,
          group_id: 'announcement',
          title: params.title,
          message: params.message,
          type: 'broadcast',
          expires_at: expTimestamp,
          metadata: {
            broadcast_id,
            target_audience: params.target_audience,
            is_broadcast: true,
            sender_name: 'Announcement',
            group_id: 'announcement',
          },
        });
      } catch (mmErr) {
        console.warn('[notifications] Dual insert to messenger_messages non-fatal warning:', mmErr);
      }

      // Invoke FCM push for background mobile delivery — sends individual notification push
      try {
        const cleanBody = stripWhatsAppFormatting(params.message);
        await supabase.functions.invoke('send-push', {
          body: {
            user_ids: params.recipient_ids,
            title: `Announcement: ${params.title}`,
            body: cleanBody,
            data: { path: '/grouping/notifications?chat_id=broadcast_announcement', chat_id: 'broadcast_announcement' },
          },
        });
      } catch (err) {
        console.warn('FCM push invoke error:', err);
      }

      return { count: rows.length, broadcast_id };
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['grouping-notifications'] });
      queryClient.invalidateQueries({ queryKey: ['sent-broadcasts'] });
      toast({
        title: vars.is_24h_broadcast ? 'Private Broadcast Sent (24h Active)' : 'Private Broadcast Sent',
        description: `Delivered to ${vars.recipient_ids.length} recipient(s) as direct notifications.`,
      });
    },
    onError: (error: Error) => {
      toast({ title: 'Send Failed', description: error.message, variant: 'destructive' });
    },
  });

  const markAsRead = useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await supabase
        .from('grouping_notifications')
        .update({ is_read: true })
        .eq('id', notificationId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grouping-notifications'] });
      queryClient.invalidateQueries({ queryKey: ['sent-broadcasts'] });
    },
  });

  const markAllAsRead = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('grouping_notifications')
        .update({ is_read: true })
        .eq('recipient_id', user!.id)
        .eq('is_read', false);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grouping-notifications'] });
      queryClient.invalidateQueries({ queryKey: ['sent-broadcasts'] });
      toast({ title: 'All notifications marked as read' });
    },
  });

  const deleteNotification = useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await supabase
        .from('grouping_notifications')
        .delete()
        .eq('id', notificationId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grouping-notifications'] });
      queryClient.invalidateQueries({ queryKey: ['sent-broadcasts'] });
    },
  });

  const deleteBroadcast = useMutation({
    mutationFn: async (broadcastId: string) => {
      const { data: sent } = await supabase
        .from('grouping_notifications')
        .select('id, metadata, title, created_at')
        .eq('sender_id', user!.id);

      const idsToDelete = (sent || [])
        .filter((n) => (n.metadata as any)?.broadcast_id === broadcastId || `${n.title}-${n.created_at}` === broadcastId)
        .map((n) => n.id);

      if (idsToDelete.length > 0) {
        const { error } = await supabase
          .from('grouping_notifications')
          .delete()
          .in('id', idsToDelete);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grouping-notifications'] });
      queryClient.invalidateQueries({ queryKey: ['sent-broadcasts'] });
      toast({ title: 'Broadcast Deleted' });
    },
    onError: (error: Error) => {
      toast({ title: 'Delete Failed', description: error.message, variant: 'destructive' });
    },
  });

  return {
    notifications: notificationsQuery.data || [],
    sentBroadcasts: sentBroadcastsQuery.data || [],
    unreadCount,
    isLoading: notificationsQuery.isLoading,
    sendNotification,
    sendTargetedNotification,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    deleteBroadcast,
    refetch: notificationsQuery.refetch,
    refetchSentBroadcasts: sentBroadcastsQuery.refetch,
  };
}


