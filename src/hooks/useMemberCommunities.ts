import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface MemberCommunity {
  id: string;
  user_id: string;
  community_name: string;
  created_at: string;
}

export const PRESET_COMMUNITIES = [
  'AI & Machine Learning Community',
  'Full Stack Software Community',
  'Robotics & Embedded Systems Community',
  'Cloud & DevOps Community',
  'Data Engineering & Analytics Community',
  'Cybersecurity & Network Security Community',
  'Product & UX Design Community',
  'Mobile App Development Community',
];

export function useMemberCommunities(userId?: string) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const communitiesQuery = useQuery({
    queryKey: ['member-communities', userId],
    queryFn: async () => {
      if (!userId) return [];
      try {
        const { data, error } = await (supabase as any)
          .from('member_communities')
          .select('*')
          .eq('user_id', userId)
          .order('community_name');

        if (!error && data) {
          return data as MemberCommunity[];
        }
      } catch (e) {
        console.warn('member_communities table error, falling back to profile metadata', e);
      }

      // Fallback: read from profiles.metadata -> communities array
      const { data: profile } = await supabase
        .from('profiles')
        .select('metadata')
        .eq('user_id', userId)
        .maybeSingle();

      const savedList = (profile?.metadata as any)?.communities || [
        'AI & Machine Learning Community',
        'Full Stack Software Community',
      ];

      return savedList.map((name: string, idx: number) => ({
        id: `comm-${idx}`,
        user_id: userId,
        community_name: name,
        created_at: new Date().toISOString(),
      })) as MemberCommunity[];
    },
    enabled: !!userId,
  });

  const addCommunity = useMutation({
    mutationFn: async (communityName: string) => {
      if (!userId || !communityName.trim()) return;

      const trimmed = communityName.trim();
      const currentList = communitiesQuery.data || [];
      if (currentList.some((c) => c.community_name.toLowerCase() === trimmed.toLowerCase())) {
        throw new Error('Already a member of this community');
      }

      try {
        const { error } = await (supabase as any).from('member_communities').insert({
          user_id: userId,
          community_name: trimmed,
        });
        if (!error) return;
      } catch (e) {
        console.warn('DB insert failed, fallback to profile metadata', e);
      }

      // Fallback to metadata
      const updatedNames = [...currentList.map((c) => c.community_name), trimmed];
      const { data: profile } = await supabase
        .from('profiles')
        .select('metadata')
        .eq('user_id', userId)
        .maybeSingle();

      const existingMeta = (profile?.metadata as any) || {};
      await supabase
        .from('profiles')
        .update({ metadata: { ...existingMeta, communities: updatedNames } } as any)
        .eq('user_id', userId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['member-communities', userId] });
      queryClient.invalidateQueries({ queryKey: ['all-member-communities'] });
      toast({ title: 'Community Added' });
    },
    onError: (err: Error) => {
      toast({ title: 'Add Failed', description: err.message, variant: 'destructive' });
    },
  });

  const removeCommunity = useMutation({
    mutationFn: async (communityName: string) => {
      if (!userId) return;

      try {
        const { error } = await (supabase as any)
          .from('member_communities')
          .delete()
          .eq('user_id', userId)
          .eq('community_name', communityName);
        if (!error) return;
      } catch (e) {
        console.warn('DB delete failed, fallback to profile metadata', e);
      }

      const currentList = communitiesQuery.data || [];
      const updatedNames = currentList
        .filter((c) => c.community_name !== communityName)
        .map((c) => c.community_name);

      const { data: profile } = await supabase
        .from('profiles')
        .select('metadata')
        .eq('user_id', userId)
        .maybeSingle();

      const existingMeta = (profile?.metadata as any) || {};
      await supabase
        .from('profiles')
        .update({ metadata: { ...existingMeta, communities: updatedNames } } as any)
        .eq('user_id', userId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['member-communities', userId] });
      queryClient.invalidateQueries({ queryKey: ['all-member-communities'] });
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
