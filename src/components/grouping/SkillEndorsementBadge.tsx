import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ThumbsUp } from 'lucide-react';
import { useSkillEndorsements } from '@/hooks/useSkillEndorsements';
import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface SkillEndorsementBadgeProps {
  memberSkillId: string;
  skillUserId: string;
}

export function SkillEndorsementBadge({ memberSkillId, skillUserId }: SkillEndorsementBadgeProps) {
  const { user } = useAuth();
  const { getEndorsementsForSkill, hasEndorsed, endorse, removeEndorsement } = useSkillEndorsements(skillUserId);
  const endorsements = getEndorsementsForSkill(memberSkillId);
  const alreadyEndorsed = hasEndorsed(memberSkillId);
  const isSelf = user?.id === skillUserId;

  // Fetch endorser names
  const endorserIds = endorsements.map(e => e.endorsed_by);
  const { data: endorserProfiles } = useQuery({
    queryKey: ['endorser-profiles', memberSkillId, endorserIds.join(',')],
    queryFn: async () => {
      if (endorserIds.length === 0) return [];
      const { data } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', endorserIds);
      return data || [];
    },
    enabled: endorserIds.length > 0,
  });

  const endorserNames = endorserProfiles?.map(p => p.full_name).join(', ') || '';

  const handleToggle = () => {
    if (alreadyEndorsed) {
      const myEndorsement = endorsements.find(e => e.endorsed_by === user?.id);
      if (myEndorsement) removeEndorsement.mutate(myEndorsement.id);
    } else {
      endorse.mutate({ member_skill_id: memberSkillId, endorsed_user_id: skillUserId });
    }
  };

  if (endorsements.length === 0 && isSelf) return null;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="inline-flex items-center gap-1">
            {!isSelf && (
              <Button
                size="icon"
                variant="ghost"
                className={`h-5 w-5 ${alreadyEndorsed ? 'text-primary' : 'text-muted-foreground'}`}
                onClick={handleToggle}
                disabled={endorse.isPending || removeEndorsement.isPending}
              >
                <ThumbsUp className={`w-3 h-3 ${alreadyEndorsed ? 'fill-primary' : ''}`} />
              </Button>
            )}
            {endorsements.length > 0 && (
              <Badge variant="outline" className="text-[9px] px-1 py-0 bg-primary/5 text-primary border-primary/20">
                +{endorsements.length}
              </Badge>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">
            {endorsements.length > 0
              ? `Endorsed by: ${endorserNames || 'loading...'}`
              : 'Endorse this skill'}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
