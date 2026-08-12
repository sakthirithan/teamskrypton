import { useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';
import { VISIBLE_PROFILE_OR } from '@/lib/profileVisibility';

export interface InchargeAppointment {
  id: string;
  user_id: string;
  position: string;
  responsibilities: string | null;
  session_id: string | null;
  appointed_by: string;
  is_active: boolean;
  created_at: string;
}

export type ActivityStatus = 'proposed' | 'scheduled' | 'final';

export interface ScheduleActivity {
  id: string;
  title: string;
  description: string | null;
  activity_date: string;
  start_time: string;
  end_time: string;
  category: string;
  location: string | null;
  status: ActivityStatus;
  sort_order: number;
  appointment_id: string | null;
  session_id: string | null;
  created_by: string;
  finalized_by: string | null;
  finalized_at: string | null;
}

export interface ActivityMember {
  id: string;
  activity_id: string;
  user_id: string;
}

export const ACTIVITY_CATEGORIES = [
  'general',
  'training',
  'review',
  'meeting',
  'workshop',
  'event',
  'deadline',
] as const;

export function useTeamMembers() {
  return useQuery({
    queryKey: ['incharge-team-members'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, full_name, email, department, avatar_url, is_disabled').or(VISIBLE_PROFILE_OR)
        .order('full_name');
      if (error) throw error;
      return (data || []).filter((p: any) => !p.is_disabled) as Array<{
        user_id: string;
        full_name: string;
        email: string;
        department: string;
        avatar_url: string | null;
      }>;
    },
    staleTime: 60_000,
  });
}

export function useIncharge() {
  const qc = useQueryClient();
  const { user, isLeadership, isCaptainOrVice, role } = useAuth();

  const appointmentsQuery = useQuery({
    queryKey: ['incharge-appointments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('incharge_appointments')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as InchargeAppointment[];
    },
  });

  const activitiesQuery = useQuery({
    queryKey: ['schedule-activities'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('schedule_activities')
        .select('*')
        .order('activity_date')
        .order('sort_order')
        .order('start_time');
      if (error) throw error;
      return (data || []) as ScheduleActivity[];
    },
  });

  const membersQuery = useQuery({
    queryKey: ['schedule-activity-members'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('schedule_activity_members')
        .select('*');
      if (error) throw error;
      return (data || []) as ActivityMember[];
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel('incharge-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'incharge_appointments' }, () => {
        qc.invalidateQueries({ queryKey: ['incharge-appointments'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'schedule_activities' }, () => {
        qc.invalidateQueries({ queryKey: ['schedule-activities'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'schedule_activity_members' }, () => {
        qc.invalidateQueries({ queryKey: ['schedule-activity-members'] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  const appointments = appointmentsQuery.data || [];
  const activities = activitiesQuery.data || [];
  const activityMembers = membersQuery.data || [];

  const myAppointments = useMemo(
    () => appointments.filter((a) => a.user_id === user?.id && a.is_active),
    [appointments, user?.id],
  );
  const isIncharge = myAppointments.length > 0;
  const isStrategist = role === 'strategist' || isCaptainOrVice;

  const membersOf = (activityId: string) =>
    activityMembers.filter((m) => m.activity_id === activityId).map((m) => m.user_id);

  const notify = async (recipientIds: string[], title: string, message: string) => {
    const unique = Array.from(new Set(recipientIds)).filter((id) => id && id !== user?.id);
    if (!unique.length) return;
    await supabase.from('grouping_notifications').insert(
      unique.map((recipient_id) => ({
        recipient_id,
        title,
        message,
        type: 'schedule',
      })) as any,
    );
  };

  const leadershipIds = async () => {
    const { data } = await supabase
      .from('user_roles')
      .select('user_id, role')
      .in('role', ['strategist', 'team_captain', 'vice_captain', 'team_manager']);
    return (data || []).map((r: any) => r.user_id as string);
  };

  const appoint = useMutation({
    mutationFn: async (input: { user_id: string; position: string; responsibilities?: string }) => {
      if (!user) throw new Error('Not authenticated');
      const { data, error } = await supabase
        .from('incharge_appointments')
        .insert({
          user_id: input.user_id,
          position: input.position,
          responsibilities: input.responsibilities || null,
          appointed_by: user.id,
        } as any)
        .select()
        .single();
      if (error) throw error;
      await notify(
        [input.user_id],
        `You are now Incharge: ${input.position}`,
        input.responsibilities || 'Open the Incharge tab to plan your activities.',
      );
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['incharge-appointments'] });
      toast.success('Incharge appointed');
    },
    onError: (e: any) => toast.error(e.message || 'Failed to appoint'),
  });

  const updateAppointment = useMutation({
    mutationFn: async ({ id, ...patch }: Partial<InchargeAppointment> & { id: string }) => {
      const { error } = await supabase.from('incharge_appointments').update(patch as any).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['incharge-appointments'] });
      toast.success('Appointment updated');
    },
    onError: (e: any) => toast.error(e.message || 'Update failed'),
  });

  const removeAppointment = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('incharge_appointments').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['incharge-appointments'] });
      toast.success('Appointment removed');
    },
    onError: (e: any) => toast.error(e.message || 'Remove failed'),
  });

  const canEditActivity = (a: ScheduleActivity | null) => {
    if (!a || !user) return false;
    if (isLeadership || isStrategist) return true;
    if (a.status === 'final') return false;
    return a.created_by === user.id;
  };

  const saveActivity = useMutation({
    mutationFn: async (input: {
      id?: string;
      title: string;
      description?: string;
      activity_date: string;
      start_time: string;
      end_time: string;
      category: string;
      location?: string;
      appointment_id?: string | null;
      memberIds: string[];
    }) => {
      if (!user) throw new Error('Not authenticated');
      if (input.id) {
        const existing = activities.find((a) => a.id === input.id);
        if (existing && !canEditActivity(existing)) {
          throw new Error('This activity is finalized and read-only for incharges.');
        }
      }

      const payload = {
        title: input.title,
        description: input.description || null,
        activity_date: input.activity_date,
        start_time: input.start_time,
        end_time: input.end_time,
        category: input.category,
        location: input.location || null,
        appointment_id: input.appointment_id ?? myAppointments[0]?.id ?? null,
      };

      let activityId = input.id;
      if (activityId) {
        const { error } = await supabase.from('schedule_activities').update(payload as any).eq('id', activityId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('schedule_activities')
          .insert({ ...payload, created_by: user.id } as any)
          .select()
          .single();
        if (error) throw error;
        activityId = (data as any).id;
      }

      await supabase.from('schedule_activity_members').delete().eq('activity_id', activityId);
      if (input.memberIds.length) {
        const { error } = await supabase.from('schedule_activity_members').insert(
          input.memberIds.map((uid) => ({ activity_id: activityId, user_id: uid })) as any,
        );
        if (error) throw error;
      }

      const planners = await leadershipIds();
      await notify(
        [...input.memberIds, ...planners],
        input.id ? `Activity updated: ${input.title}` : `New activity planned: ${input.title}`,
        `${input.activity_date} · ${input.start_time.slice(0, 5)}–${input.end_time.slice(0, 5)}`,
      );
      return activityId;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['schedule-activities'] });
      qc.invalidateQueries({ queryKey: ['schedule-activity-members'] });
      toast.success('Activity saved');
    },
    onError: (e: any) => toast.error(e.message || 'Failed to save activity'),
  });

  const moveActivity = useMutation({
    mutationFn: async (input: {
      id: string;
      activity_date?: string;
      start_time?: string;
      end_time?: string;
      sort_order?: number;
    }) => {
      const existing = activities.find((a) => a.id === input.id);
      if (existing && !canEditActivity(existing)) {
        throw new Error('Finalized activities cannot be moved by incharges.');
      }
      const { id, ...patch } = input;
      const { error } = await supabase.from('schedule_activities').update(patch as any).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['schedule-activities'] }),
    onError: (e: any) => toast.error(e.message || 'Move failed'),
  });

  const deleteActivity = useMutation({
    mutationFn: async (id: string) => {
      const existing = activities.find((a) => a.id === id);
      if (existing && !canEditActivity(existing)) {
        throw new Error('Finalized activities cannot be deleted by incharges.');
      }
      const { error } = await supabase.from('schedule_activities').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['schedule-activities'] });
      toast.success('Activity deleted');
    },
    onError: (e: any) => toast.error(e.message || 'Delete failed'),
  });

  const setStatus = useMutation({
    mutationFn: async ({ ids, status }: { ids: string[]; status: ActivityStatus }) => {
      if (!user) throw new Error('Not authenticated');
      const patch: any = { status };
      if (status === 'final') {
        patch.finalized_by = user.id;
        patch.finalized_at = new Date().toISOString();
      } else {
        patch.finalized_by = null;
        patch.finalized_at = null;
      }
      const { error } = await supabase.from('schedule_activities').update(patch).in('id', ids);
      if (error) throw error;

      if (status === 'final') {
        const affected = activityMembers.filter((m) => ids.includes(m.activity_id)).map((m) => m.user_id);
        const creators = activities.filter((a) => ids.includes(a.id)).map((a) => a.created_by);
        await notify(
          [...affected, ...creators],
          'Activity finalized and mapped to your schedule.',
          'The team schedule has been finalized. Check My Calendar to view details.',
        );
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['schedule-activities'] });
      toast.success('Schedule updated');
    },
    onError: (e: any) => toast.error(e.message || 'Failed to update schedule'),
  });

  return {
    appointments,
    activities,
    activityMembers,
    membersOf,
    myAppointments,
    isIncharge,
    isStrategist,
    isLeadership,
    canEditActivity,
    canAppoint: isCaptainOrVice,
    isLoading: appointmentsQuery.isLoading || activitiesQuery.isLoading,
    appoint,
    updateAppointment,
    removeAppointment,
    saveActivity,
    moveActivity,
    deleteActivity,
    setStatus,
  };
}
