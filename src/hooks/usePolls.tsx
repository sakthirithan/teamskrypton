import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export type PollMode = 'grouping' | 'pbl';

export interface Poll {
  id: string;
  creator_id: string;
  mode: PollMode;
  session_id: string | null;
  project_id: string | null;
  title: string;
  description: string | null;
  allow_multiple: boolean;
  deadline: string | null;
  status: 'open' | 'closed';
  results_published: boolean;
  created_at: string;
}

export interface PollOption {
  id: string;
  poll_id: string;
  label: string;
  order_index: number;
}

export interface PollVote {
  id: string;
  poll_id: string;
  option_id: string;
  voter_id: string;
  created_at: string;
}

export function usePolls(mode: PollMode) {
  const qc = useQueryClient();
  const { user } = useAuth();

  const pollsQuery = useQuery({
    queryKey: ['polls', mode],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('polls')
        .select('*')
        .eq('mode', mode)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as Poll[];
    },
  });

  const optionsQuery = useQuery({
    queryKey: ['poll_options', mode],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('poll_options')
        .select('*')
        .order('order_index');
      if (error) throw error;
      return (data || []) as PollOption[];
    },
  });

  const votesQuery = useQuery({
    queryKey: ['poll_votes', mode],
    queryFn: async () => {
      const { data, error } = await supabase.from('poll_votes').select('*');
      if (error) throw error;
      return (data || []) as PollVote[];
    },
  });

  // Realtime subscriptions
  useEffect(() => {
    const ch = supabase
      .channel(`polls-${mode}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'polls' }, () =>
        qc.invalidateQueries({ queryKey: ['polls', mode] }))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'poll_options' }, () =>
        qc.invalidateQueries({ queryKey: ['poll_options', mode] }))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'poll_votes' }, () =>
        qc.invalidateQueries({ queryKey: ['poll_votes', mode] }))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'poll_teams' }, () =>
        qc.invalidateQueries({ queryKey: ['poll_teams'] }))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'poll_team_members' }, () =>
        qc.invalidateQueries({ queryKey: ['poll_team_members'] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [mode, qc]);

  const createPoll = useMutation({
    mutationFn: async (input: {
      title: string;
      description?: string;
      allow_multiple: boolean;
      deadline?: string | null;
      options: string[];
      session_id?: string | null;
      project_id?: string | null;
      notify_recipient_ids?: string[];
      sender_name?: string;
    }) => {
      if (!user) throw new Error('Not signed in');
      const { data: poll, error } = await supabase
        .from('polls')
        .insert({
          creator_id: user.id,
          mode,
          title: input.title,
          description: input.description || null,
          allow_multiple: input.allow_multiple,
          deadline: input.deadline || null,
          session_id: input.session_id || null,
          project_id: input.project_id || null,
        })
        .select()
        .single();
      if (error) throw error;

      const rows = input.options
        .filter((s) => s.trim())
        .map((label, i) => ({ poll_id: poll.id, label: label.trim(), order_index: i }));
      const { error: optErr } = await supabase.from('poll_options').insert(rows);
      if (optErr) throw optErr;

      if (input.notify_recipient_ids?.length) {
        await supabase.functions.invoke('poll-notify', {
          body: {
            poll_id: poll.id,
            recipient_ids: input.notify_recipient_ids,
            sender_name: input.sender_name,
          },
        });
      }
      return poll as Poll;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['polls', mode] });
      toast.success('Poll created');
    },
    onError: (e: any) => toast.error(e.message || 'Failed to create poll'),
  });

  const castVote = useMutation({
    mutationFn: async ({ poll, optionId }: { poll: Poll; optionId: string }) => {
      if (!user) throw new Error('Not signed in');
      if (!poll.allow_multiple) {
        // Clear any previous votes on this poll
        await supabase.from('poll_votes').delete().eq('poll_id', poll.id).eq('voter_id', user.id);
      }
      const { error } = await supabase
        .from('poll_votes')
        .insert({ poll_id: poll.id, option_id: optionId, voter_id: user.id });
      if (error && !String(error.message).toLowerCase().includes('duplicate')) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['poll_votes', mode] }),
    onError: (e: any) => toast.error(e.message || 'Vote failed'),
  });

  const removeVote = useMutation({
    mutationFn: async ({ pollId, optionId }: { pollId: string; optionId: string }) => {
      if (!user) throw new Error('Not signed in');
      const { error } = await supabase
        .from('poll_votes').delete()
        .eq('poll_id', pollId).eq('option_id', optionId).eq('voter_id', user.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['poll_votes', mode] }),
  });

  const closePoll = useMutation({
    mutationFn: async (pollId: string) => {
      const { error } = await supabase
        .from('polls').update({ status: 'closed', results_published: true }).eq('id', pollId);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['polls', mode] }); toast.success('Poll closed & results published'); },
    onError: (e: any) => toast.error(e.message),
  });

  const deletePoll = useMutation({
    mutationFn: async (pollId: string) => {
      const { error } = await supabase.from('polls').delete().eq('id', pollId);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['polls', mode] }); toast.success('Poll deleted'); },
    onError: (e: any) => toast.error(e.message),
  });

  return {
    polls: pollsQuery.data ?? [],
    options: optionsQuery.data ?? [],
    votes: votesQuery.data ?? [],
    isLoading: pollsQuery.isLoading,
    createPoll, castVote, removeVote, closePoll, deletePoll,
  };
}

export function usePollTeams(pollId: string | null) {
  const qc = useQueryClient();
  const teams = useQuery({
    queryKey: ['poll_teams', pollId],
    enabled: !!pollId,
    queryFn: async () => {
      const { data, error } = await supabase.from('poll_teams').select('*').eq('poll_id', pollId!);
      if (error) throw error;
      return data || [];
    },
  });
  const members = useQuery({
    queryKey: ['poll_team_members', pollId],
    enabled: !!pollId,
    queryFn: async () => {
      if (!teams.data?.length) return [];
      const ids = teams.data.map((t: any) => t.id);
      const { data, error } = await supabase.from('poll_team_members').select('*').in('team_id', ids);
      if (error) throw error;
      return data || [];
    },
  });
  const saveDivision = useMutation({
    mutationFn: async ({ pollId, teams: t }: { pollId: string; teams: { name: string; based_on_option_id: string | null; members: string[] }[] }) => {
      // wipe existing teams for this poll
      await supabase.from('poll_teams').delete().eq('poll_id', pollId);
      for (const team of t) {
        const { data: created, error } = await supabase
          .from('poll_teams')
          .insert({ poll_id: pollId, name: team.name, based_on_option_id: team.based_on_option_id })
          .select().single();
        if (error) throw error;
        if (team.members.length) {
          const rows = team.members.map((uid) => ({ team_id: created.id, user_id: uid }));
          await supabase.from('poll_team_members').insert(rows);
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['poll_teams'] });
      qc.invalidateQueries({ queryKey: ['poll_team_members'] });
      toast.success('Teams created');
    },
    onError: (e: any) => toast.error(e.message),
  });
  return { teams: teams.data ?? [], members: members.data ?? [], saveDivision };
}
