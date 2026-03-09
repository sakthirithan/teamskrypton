import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

export interface SkillTrack {
  id: string;
  session_id: string;
  user_id: string;
  skill_name: string;
  is_primary: boolean;
  week_start: string;
  created_at: string;
  updated_at: string;
}

export interface FlowchartBlock {
  id: string;
  skill_track_id: string;
  title: string;
  description: string | null;
  resource_url: string | null;
  sort_order: number;
  status: string;
  block_shape: string;
  created_at: string;
  updated_at: string;
}

export interface SkillSuggestion {
  id: string;
  name: string;
  category: string;
  created_by: string;
  created_at: string;
}

export function useSkillTracks(sessionId?: string, userId?: string) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch skill tracks for a user in a session
  const tracksQuery = useQuery({
    queryKey: ['skill-tracks', sessionId, userId],
    queryFn: async () => {
      if (!sessionId || !userId) return [];
      const { data, error } = await supabase
        .from('skill_tracks')
        .select('*')
        .eq('session_id', sessionId)
        .eq('user_id', userId)
        .order('week_start', { ascending: false });
      if (error) throw error;
      return data as SkillTrack[];
    },
    enabled: !!sessionId && !!userId,
  });

  // Fetch flowchart blocks for a specific skill track
  const useFlowchartBlocks = (trackId?: string) => {
    return useQuery({
      queryKey: ['flowchart-blocks', trackId],
      queryFn: async () => {
        if (!trackId) return [];
        const { data, error } = await supabase
          .from('skill_flowchart_blocks')
          .select('*')
          .eq('skill_track_id', trackId)
          .order('sort_order', { ascending: true });
        if (error) throw error;
        return data as FlowchartBlock[];
      },
      enabled: !!trackId,
    });
  };

  // Fetch skill suggestions
  const suggestionsQuery = useQuery({
    queryKey: ['skill-suggestions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('skill_suggestions')
        .select('*')
        .order('name');
      if (error) throw error;
      return data as SkillSuggestion[];
    },
  });

  // Create skill track
  const createTrack = useMutation({
    mutationFn: async (params: { skill_name: string; is_primary: boolean; week_start: string }) => {
      if (!sessionId || !user) throw new Error('Missing session or user');
      const { data, error } = await supabase
        .from('skill_tracks')
        .insert({
          session_id: sessionId,
          user_id: user.id,
          skill_name: params.skill_name,
          is_primary: params.is_primary,
          week_start: params.week_start,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['skill-tracks', sessionId, userId] });
      toast({ title: 'Skill added', description: 'New skill track created.' });
    },
    onError: (e: Error) => toast({ variant: 'destructive', title: 'Error', description: e.message }),
  });

  // Update skill track
  const updateTrack = useMutation({
    mutationFn: async (params: { id: string; skill_name?: string; is_primary?: boolean }) => {
      const { id, ...updates } = params;
      const { error } = await supabase
        .from('skill_tracks')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['skill-tracks', sessionId, userId] });
    },
    onError: (e: Error) => toast({ variant: 'destructive', title: 'Error', description: e.message }),
  });

  // Delete skill track
  const deleteTrack = useMutation({
    mutationFn: async (trackId: string) => {
      const { error } = await supabase.from('skill_tracks').delete().eq('id', trackId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['skill-tracks', sessionId, userId] });
      toast({ title: 'Skill removed' });
    },
    onError: (e: Error) => toast({ variant: 'destructive', title: 'Error', description: e.message }),
  });

  // Create flowchart block
  const createBlock = useMutation({
    mutationFn: async (params: { skill_track_id: string; title: string; description?: string; resource_url?: string; sort_order: number }) => {
      const { data, error } = await supabase
        .from('skill_flowchart_blocks')
        .insert(params)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['flowchart-blocks', vars.skill_track_id] });
      toast({ title: 'Step added' });
    },
    onError: (e: Error) => toast({ variant: 'destructive', title: 'Error', description: e.message }),
  });

  // Update flowchart block
  const updateBlock = useMutation({
    mutationFn: async (params: { id: string; skill_track_id: string; title?: string; description?: string; resource_url?: string; status?: string; sort_order?: number }) => {
      const { id, skill_track_id, ...updates } = params;
      const { error } = await supabase
        .from('skill_flowchart_blocks')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['flowchart-blocks', vars.skill_track_id] });
    },
    onError: (e: Error) => toast({ variant: 'destructive', title: 'Error', description: e.message }),
  });

  // Delete flowchart block
  const deleteBlock = useMutation({
    mutationFn: async (params: { id: string; skill_track_id: string }) => {
      const { error } = await supabase.from('skill_flowchart_blocks').delete().eq('id', params.id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['flowchart-blocks', vars.skill_track_id] });
      toast({ title: 'Step removed' });
    },
    onError: (e: Error) => toast({ variant: 'destructive', title: 'Error', description: e.message }),
  });

  // Add skill suggestion (leadership)
  const addSuggestion = useMutation({
    mutationFn: async (params: { name: string; category?: string }) => {
      if (!user) throw new Error('Not authenticated');
      const { error } = await supabase
        .from('skill_suggestions')
        .insert({ name: params.name, category: params.category || 'general', created_by: user.id });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['skill-suggestions'] });
      toast({ title: 'Skill suggestion added' });
    },
    onError: (e: Error) => toast({ variant: 'destructive', title: 'Error', description: e.message }),
  });

  // Delete skill suggestion (leadership)
  const deleteSuggestion = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('skill_suggestions').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['skill-suggestions'] });
    },
  });

  return {
    tracks: tracksQuery.data || [],
    isLoading: tracksQuery.isLoading,
    suggestions: suggestionsQuery.data || [],
    useFlowchartBlocks,
    createTrack,
    updateTrack,
    deleteTrack,
    createBlock,
    updateBlock,
    deleteBlock,
    addSuggestion,
    deleteSuggestion,
  };
}
