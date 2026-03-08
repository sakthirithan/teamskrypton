import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

export interface SkillEndorsement {
  id: string;
  member_skill_id: string;
  endorsed_user_id: string;
  endorsed_by: string;
  comment: string | null;
  created_at: string;
}

export function useSkillEndorsements(userId?: string) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get endorsements for a user's skills
  const endorsementsQuery = useQuery({
    queryKey: ['skill-endorsements', userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from('skill_endorsements' as any)
        .select('*')
        .eq('endorsed_user_id', userId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as unknown as SkillEndorsement[];
    },
    enabled: !!userId,
  });

  const endorse = useMutation({
    mutationFn: async (params: { member_skill_id: string; endorsed_user_id: string; comment?: string }) => {
      if (!user) throw new Error('Not authenticated');
      if (user.id === params.endorsed_user_id) throw new Error("You can't endorse your own skill");
      const { data, error } = await supabase
        .from('skill_endorsements' as any)
        .insert({
          member_skill_id: params.member_skill_id,
          endorsed_user_id: params.endorsed_user_id,
          endorsed_by: user.id,
          comment: params.comment || null,
        } as any)
        .select()
        .single();
      if (error) {
        if (error.code === '23505') throw new Error('You already endorsed this skill');
        throw error;
      }
      return data;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['skill-endorsements', vars.endorsed_user_id] });
      toast({ title: 'Skill endorsed!', description: 'Your endorsement has been recorded.' });
    },
    onError: (e: Error) => toast({ variant: 'destructive', title: 'Error', description: e.message }),
  });

  const removeEndorsement = useMutation({
    mutationFn: async (endorsementId: string) => {
      const { error } = await supabase
        .from('skill_endorsements' as any)
        .delete()
        .eq('id', endorsementId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['skill-endorsements', userId] });
      toast({ title: 'Endorsement removed' });
    },
    onError: (e: Error) => toast({ variant: 'destructive', title: 'Error', description: e.message }),
  });

  const endorsements = endorsementsQuery.data || [];
  const getEndorsementsForSkill = (memberSkillId: string) =>
    endorsements.filter(e => e.member_skill_id === memberSkillId);
  const hasEndorsed = (memberSkillId: string) =>
    endorsements.some(e => e.member_skill_id === memberSkillId && e.endorsed_by === user?.id);

  return {
    endorsements,
    isLoading: endorsementsQuery.isLoading,
    getEndorsementsForSkill,
    hasEndorsed,
    endorse,
    removeEndorsement,
  };
}
