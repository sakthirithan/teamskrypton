import { Badge } from '@/components/ui/badge';
import { useMemberSkills, SKILL_TYPE_LABELS, SKILL_DOMAIN_LABELS, SkillType, SkillDomain } from '@/hooks/useMemberSkills';
import { SkillEndorsementBadge } from '@/components/grouping/SkillEndorsementBadge';

interface MemberSkillsBadgesProps {
  userId: string;
  compact?: boolean;
}

function getSkillTypeColor(type: SkillType): string {
  switch (type) {
    case 'primary': return 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20';
    case 'secondary': return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20';
    case 'specialization': return 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20';
  }
}

export function MemberSkillsBadges({ userId, compact = false }: MemberSkillsBadgesProps) {
  const { skills, isLoading } = useMemberSkills(userId);

  if (isLoading || skills.length === 0) return null;

  if (compact) {
    return (
      <div className="flex flex-wrap gap-1 mt-1">
        {skills.slice(0, 4).map(skill => (
          <Badge key={skill.id} variant="outline" className={`text-[9px] px-1.5 py-0 ${getSkillTypeColor(skill.skill_type)}`}>
            {skill.skill_name}
          </Badge>
        ))}
        {skills.length > 4 && (
          <Badge variant="outline" className="text-[9px] px-1.5 py-0 text-muted-foreground">
            +{skills.length - 4}
          </Badge>
        )}
      </div>
    );
  }

  const grouped: Record<SkillType, typeof skills> = {
    primary: skills.filter(s => s.skill_type === 'primary'),
    secondary: skills.filter(s => s.skill_type === 'secondary'),
    specialization: skills.filter(s => s.skill_type === 'specialization'),
  };

  return (
    <div className="space-y-1.5">
      {(['primary', 'secondary', 'specialization'] as SkillType[]).map(type => {
        const items = grouped[type];
        if (items.length === 0) return null;
        return (
          <div key={type} className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider w-14 shrink-0">
              {type === 'specialization' ? 'Spec' : SKILL_TYPE_LABELS[type]}
            </span>
            {items.map(skill => (
              <Badge key={skill.id} variant="outline" className={`text-[10px] px-1.5 py-0 ${getSkillTypeColor(skill.skill_type)}`}>
                {skill.skill_name}
              </Badge>
            ))}
          </div>
        );
      })}
    </div>
  );
}
