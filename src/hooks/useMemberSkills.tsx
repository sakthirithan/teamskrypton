import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

import { DOMAIN_OPTIONS, SKILL_DOMAIN_LABELS, SKILL_TO_DOMAIN_MAP, getEffectiveDomain, mapUiDomainToDbDomain } from '@/lib/skillDomains';

export type SkillType = 'primary' | 'secondary' | 'specialization';
export type SkillDomain = string;
export { DOMAIN_OPTIONS, SKILL_DOMAIN_LABELS, SKILL_TO_DOMAIN_MAP, getEffectiveDomain };

export interface MemberSkill {
  id: string;
  user_id: string;
  skill_name: string;
  skill_type: SkillType;
  domain: SkillDomain;
  custom_domain: string | null;
  assigned_by: string;
  created_at: string;
  updated_at: string;
}

export const SKILL_TYPE_LABELS: Record<SkillType, string> = {
  primary: 'Primary',
  secondary: 'Secondary',
  specialization: 'Specialization',
};

export const SKILL_TYPE_LIMITS: Record<SkillType, { min: number; max: number }> = {
  primary: { min: 0, max: 2 },
  secondary: { min: 0, max: 2 },
  specialization: { min: 0, max: 3 },
};

export function useMemberSkills(userId?: string) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const skillsQuery = useQuery({
    queryKey: ['member-skills', userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from('member_skills')
        .select('*')
        .eq('user_id', userId)
        .order('skill_type')
        .order('skill_name');
      if (error) throw error;
      return data as MemberSkill[];
    },
    enabled: !!userId,
  });

  // Fetch all member skills (for team overview)
  const allSkillsQuery = useQuery({
    queryKey: ['all-member-skills'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('member_skills')
        .select('*')
        .order('skill_type')
        .order('skill_name');
      if (error) throw error;
      return data as MemberSkill[];
    },
  });

  const assignSkill = useMutation({
    mutationFn: async (params: { user_id: string; skill_name: string; skill_type: SkillType; domain: string; custom_domain?: string; assigned_by?: string }) => {
      if (!user) throw new Error('Not authenticated');
      const { domain: dbDomain, custom_domain: mappedCustomDomain } = mapUiDomainToDbDomain(params.domain);
      const { data, error } = await supabase
        .from('member_skills')
        .insert({
          user_id: params.user_id,
          skill_name: params.skill_name,
          skill_type: params.skill_type,
          domain: dbDomain,
          custom_domain: params.custom_domain || mappedCustomDomain || null,
          assigned_by: params.assigned_by || user.id,
        } as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['member-skills', vars.user_id] });
      queryClient.invalidateQueries({ queryKey: ['all-member-skills'] });
      toast({ title: 'Skill assigned', description: `${vars.skill_name} added as ${SKILL_TYPE_LABELS[vars.skill_type]}` });
    },
    onError: (e: Error) => toast({ variant: 'destructive', title: 'Error', description: e.message }),
  });

  const updateSkill = useMutation({
    mutationFn: async (params: { 
      id: string; 
      user_id?: string; 
      skill_name?: string; 
      skill_type?: SkillType; 
      domain?: string; 
      custom_domain?: string | null; 
    }) => {
      const { id, user_id, ...updates } = params;
      const finalUpdates: any = { ...updates };
      if (params.domain) {
        const { domain: dbDomain, custom_domain: mappedCustomDomain } = mapUiDomainToDbDomain(params.domain);
        finalUpdates.domain = dbDomain;
        finalUpdates.custom_domain = params.custom_domain !== undefined ? params.custom_domain : (mappedCustomDomain || null);
      }
      const { data, error } = await supabase
        .from('member_skills')
        .update({
          ...finalUpdates,
          updated_at: new Date().toISOString(),
        } as any)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data, vars) => {
      const targetUserId = vars.user_id || userId;
      if (targetUserId) {
        queryClient.invalidateQueries({ queryKey: ['member-skills', targetUserId] });
      }
      queryClient.invalidateQueries({ queryKey: ['all-member-skills'] });
      toast({ title: 'Skill updated', description: `${vars.skill_name || 'Skill'} updated successfully.` });
    },
    onError: (e: Error) => toast({ variant: 'destructive', title: 'Error', description: e.message }),
  });

  const removeSkill = useMutation({
    mutationFn: async (skillId: string) => {
      const { error } = await supabase.from('member_skills').delete().eq('id', skillId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['member-skills', userId] });
      queryClient.invalidateQueries({ queryKey: ['all-member-skills'] });
      toast({ title: 'Skill removed' });
    },
    onError: (e: Error) => toast({ variant: 'destructive', title: 'Error', description: e.message }),
  });

  const skills = skillsQuery.data || [];
  const getByType = (type: SkillType) => skills.filter(s => s.skill_type === type);
  const canAdd = (type: SkillType) => getByType(type).length < SKILL_TYPE_LIMITS[type].max;

  return {
    skills,
    isLoading: skillsQuery.isLoading,
    allSkills: allSkillsQuery.data || [],
    getByType,
    canAdd,
    assignSkill,
    updateSkill,
    removeSkill,
  };
}
