import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

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
}

export function useGroupingNotifications() {
  const { user, isLeadership } = useAuth();
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
      return (data || []) as GroupingNotification[];
    },
    enabled: !!user,
  });

  const unreadCount = (notificationsQuery.data || []).filter(n => !n.is_read).length;

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
    markAsRead,
    markAllAsRead,
    deleteNotification,
    refetch: notificationsQuery.refetch,
  };
}
