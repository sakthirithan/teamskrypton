import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

export interface MemberCommunity {
  id: string;
  user_id: string;
  community_name: string;
  created_at: string;
}

// Kept for backward compatibility imports, but emptied as we don't display pre-built options
export const PRESET_COMMUNITIES: string[] = [];

export function useMemberCommunities(userId?: string) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const communitiesQuery = useQuery({
    queryKey: ['member-communities', userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from('member_communities')
        .select('*')
        .eq('user_id', userId)
        .order('community_name');

      if (error) throw error;
      return (data || []) as MemberCommunity[];
    },
    enabled: !!userId,
  });

  const addCommunity = useMutation({
    mutationFn: async (communityName: string) => {
      if (!userId || !communityName.trim()) return;
      if (!user) throw new Error('Not authenticated');

      const trimmed = communityName.trim();
      const currentList = communitiesQuery.data || [];
      if (currentList.some((c) => c.community_name.toLowerCase() === trimmed.toLowerCase())) {
        throw new Error('Already a member of this community');
      }

      const { data, error } = await supabase
        .from('member_communities')
        .insert({
          user_id: userId,
          community_name: trimmed,
          assigned_by: user.id,
        } as any)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['member-communities', userId] });
      queryClient.invalidateQueries({ queryKey: ['all-member-communities-counts'] });
      toast({ title: 'Community Added' });
    },
    onError: (err: Error) => {
      toast({ title: 'Add Failed', description: err.message, variant: 'destructive' });
    },
  });

  const removeCommunity = useMutation({
    mutationFn: async (communityName: string) => {
      if (!userId) return;

      const { error } = await supabase
        .from('member_communities')
        .delete()
        .eq('user_id', userId)
        .eq('community_name', communityName);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['member-communities', userId] });
      queryClient.invalidateQueries({ queryKey: ['all-member-communities-counts'] });
      toast({ title: 'Community Removed' });
    },
    onError: (err: Error) => {
      toast({ title: 'Remove Failed', description: err.message, variant: 'destructive' });
    },
  });

  return {
    communities: communitiesQuery.data || [],
    isLoading: communitiesQuery.isLoading,
    addCommunity,
    removeCommunity,
  };
}
