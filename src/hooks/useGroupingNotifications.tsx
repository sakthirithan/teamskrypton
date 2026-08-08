import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Badge } from '@capawesome/capacitor-badge';
import { stripWhatsAppFormatting } from '@/components/ui/whatsapp-text';

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

      // Filter out expired 24-hour broadcasts
      const now = new Date().toISOString();
      const validNotifs = ((data || []) as GroupingNotification[]).filter((n) => {
        if (n.expires_at && new Date(n.expires_at).toISOString() <= now) {
          return false;
        }
        return true;
      });

      return validNotifs;
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

    if (!user) return;

    const channel = supabase
      .channel(`grouping-notifications-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'grouping_notifications',
          filter: `recipient_id=eq.${user.id}`,
        },
        async (payload) => {
          const newNotif = payload.new as GroupingNotification;
          
          // Refresh the notifications list
          queryClient.invalidateQueries({ queryKey: ['grouping-notifications'] });
          
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
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, queryClient]);

  // Original single recipient send
  const sendNotification = useMutation({
    mutationFn: async (params: {
      recipient_id: string;
      title: string;
      message?: string;
      type?: string;
      session_id?: string;
    }) => {
      const { data, error } = await supabase
        .from('grouping_notifications')
        .insert({
          sender_id: user!.id,
          recipient_id: params.recipient_id,
          title: params.title,
          message: params.message || null,
          type: params.type || 'info',
          session_id: params.session_id || null,
        })
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
      toast({ title: 'Notification Sent' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // Targeted batch / group / broadcast notification send
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

      const expires_at = params.is_24h_broadcast
        ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        : null;

      const rows = params.recipient_ids.map((recipient_id) => ({
        sender_id: user.id,
        recipient_id,
        title: params.title,
        message: params.message,
        type: params.type || (params.is_24h_broadcast ? 'broadcast' : 'info'),
        session_id: params.session_id || null,
        target_audience: params.target_audience,
        expires_at,
        is_broadcast: !!params.is_24h_broadcast,
      }));

      const { error } = await supabase.from('grouping_notifications').insert(rows as any);
      if (error) throw error;

      // Invoke FCM push for background mobile delivery
      try {
        const cleanBody = stripWhatsAppFormatting(params.message);
        await supabase.functions.invoke('send-push', {
          body: {
            user_ids: params.recipient_ids,
            title: params.title,
            body: cleanBody,
            data: { path: '/grouping/notifications' },
          },
        });
      } catch (err) {
        console.warn('FCM push invoke error:', err);
      }

      return { count: rows.length };
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['grouping-notifications'] });
      toast({
        title: vars.is_24h_broadcast ? 'Broadcast Sent (24h Active)' : 'Notification Sent',
        description: `Delivered to ${vars.recipient_ids.length} recipient(s)`,
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
    },
  });

  return {
    notifications: notificationsQuery.data || [],
    unreadCount,
    isLoading: notificationsQuery.isLoading,
    sendNotification,
    sendTargetedNotification,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    refetch: notificationsQuery.refetch,
  };
}

