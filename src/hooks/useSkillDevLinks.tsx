import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

export interface SkillDevLink {
  id: string;
  skill_track_id: string;
  user_id: string;
  title: string;
  url: string;
  link_type: string;
  created_at: string;
}

export function useSkillDevLinks(trackId?: string) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const linksQuery = useQuery({
    queryKey: ['skill-dev-links', trackId],
    queryFn: async () => {
      if (!trackId) return [];
      const { data, error } = await supabase
        .from('skill_dev_links' as any)
        .select('*')
        .eq('skill_track_id', trackId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as unknown as SkillDevLink[];
    },
    enabled: !!trackId,
  });

  const addLink = useMutation({
    mutationFn: async (params: { title: string; url: string; link_type: string }) => {
      if (!user || !trackId) throw new Error('Not authenticated');
      const { data, error } = await supabase
        .from('skill_dev_links' as any)
        .insert({
          skill_track_id: trackId,
          user_id: user.id,
          title: params.title,
          url: params.url,
          link_type: params.link_type,
        } as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['skill-dev-links', trackId] });
      toast({ title: 'Link added', description: 'Development link saved successfully.' });
    },
    onError: (e: Error) => toast({ variant: 'destructive', title: 'Error', description: e.message }),
  });

  const removeLink = useMutation({
    mutationFn: async (linkId: string) => {
      const { error } = await supabase
        .from('skill_dev_links' as any)
        .delete()
        .eq('id', linkId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['skill-dev-links', trackId] });
      toast({ title: 'Link removed' });
    },
    onError: (e: Error) => toast({ variant: 'destructive', title: 'Error', description: e.message }),
  });

  return {
    links: linksQuery.data || [],
    isLoading: linksQuery.isLoading,
    addLink,
    removeLink,
  };
}
