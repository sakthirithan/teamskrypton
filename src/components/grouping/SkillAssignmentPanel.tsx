import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Trash2, Sparkles, GraduationCap } from 'lucide-react';
import { 
  useMemberSkills, 
  SKILL_TYPE_LABELS, 
  SKILL_TYPE_LIMITS, 
  SKILL_DOMAIN_LABELS, 
  SkillType, 
  SkillDomain 
} from '@/hooks/useMemberSkills';
import { useAuth } from '@/hooks/useAuth';

interface SkillAssignmentPanelProps {
  userId: string;
  userName: string;
  /** If true, only self-assign (user creating own skills). If false, leadership mode. */
  isSelfMode?: boolean;
}

function getSkillTypeColor(type: SkillType): string {
  switch (type) {
    case 'primary': return 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20';
    case 'secondary': return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20';
    case 'specialization': return 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20';
  }
}

export function SkillAssignmentPanel({ userId, userName, isSelfMode = false }: SkillAssignmentPanelProps) {
  const { user, isLeadership } = useAuth();
  const { skills, getByType, canAdd, assignSkill, removeSkill } = useMemberSkills(userId);
  const [isOpen, setIsOpen] = useState(false);
  const [skillName, setSkillName] = useState('');
  const [skillType, setSkillType] = useState<SkillType>('primary');
  const [domain, setDomain] = useState<SkillDomain | 'custom'>('general');
  const [customDomain, setCustomDomain] = useState('');

  // Once skills are set, only leadership can edit/delete
  const canDelete = isLeadership;
  // Users can create if they have no skills yet; leadership can always create
  const canCreate = isLeadership || (isSelfMode && skills.length === 0 || skills.length <= 5 );

  const handleAssign = async () => {
    if (!skillName.trim()) return;
    if (!canAdd(skillType)) return;
    if (domain === 'custom' && !customDomain.trim()) return;
    
    await assignSkill.mutateAsync({
      user_id: userId,
      skill_name: skillName.trim(),
      skill_type: skillType,
      domain: domain === 'custom' ? 'general' : domain,
      custom_domain: domain === 'custom' ? customDomain.trim() : undefined,
      assigned_by: user?.id,
    });
    setSkillName('');
    setCustomDomain('');
    setDomain('general');
    setIsOpen(false);
  };

  const primarySkills = getByType('primary');
  const secondarySkills = getByType('secondary');
  const specSkills = getByType('specialization');

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-base">
            <GraduationCap className="w-4 h-4 text-primary" />
            Skills — {isSelfMode ? 'My Skills' : userName}
          </span>
          {canCreate && (
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline">
                  <Plus className="w-4 h-4 mr-1" />
                  {isSelfMode ? 'Add Skill' : 'Assign'}
                </Button>
              </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{isSelfMode ? 'Add Your Skill' : `Assign Skill to ${userName}`}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Skill Name</Label>
                  <Input
                    value={skillName}
                    onChange={e => setSkillName(e.target.value)}
                    placeholder="e.g., React, Machine Learning, UI Design"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Skill Type</Label>
                  <Select value={skillType} onValueChange={v => setSkillType(v as SkillType)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(['primary', 'secondary', 'specialization'] as SkillType[]).map(type => (
                        <SelectItem key={type} value={type} disabled={!canAdd(type)}>
                          {SKILL_TYPE_LABELS[type]} ({getByType(type).length}/{SKILL_TYPE_LIMITS[type].max})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Domain</Label>
                  <Select value={domain} onValueChange={v => setDomain(v as SkillDomain | 'custom')}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.entries(SKILL_DOMAIN_LABELS) as [SkillDomain, string][]).map(([key, label]) => (
                        <SelectItem key={key} value={key}>{label}</SelectItem>
                      ))}
                      <SelectItem value="custom">✨ Custom Domain</SelectItem>
                    </SelectContent>
                  </Select>
                  {domain === 'custom' && (
                    <Input
                      value={customDomain}
                      onChange={e => setCustomDomain(e.target.value)}
                      placeholder="Enter your custom domain name"
                      className="mt-2"
                    />
                  )}
                </div>

                {/* Limits info */}
                <div className="text-xs text-muted-foreground space-y-1 bg-muted/50 rounded-lg p-3">
                  <p className="font-medium">Limits per member:</p>
                  <p>• Primary: max 2 • Secondary: max 2 • Specialization: max 3</p>
                  {!isLeadership && (
                    <p className="text-amber-600 dark:text-amber-400 mt-1">
                      ⚠ Only leadership can remove skills once added.
                    </p>
                  )}
                </div>

                <Button 
                  onClick={handleAssign} 
                  className="w-full" 
                  disabled={!skillName.trim() || !canAdd(skillType) || assignSkill.isPending || (domain === 'custom' && !customDomain.trim())}
                >
                  {assignSkill.isPending ? 'Adding...' : isSelfMode ? 'Add Skill' : 'Assign Skill'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {skills.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No skills assigned yet. Click "{isSelfMode ? 'Add Skill' : 'Assign'}" to add skills.
          </p>
        ) : (
          <div className="space-y-3">
            {primarySkills.length > 0 && (
              <SkillGroup type="primary" skills={primarySkills} onRemove={canDelete ? (id => removeSkill.mutate(id)) : undefined} />
            )}
            {secondarySkills.length > 0 && (
              <SkillGroup type="secondary" skills={secondarySkills} onRemove={canDelete ? (id => removeSkill.mutate(id)) : undefined} />
            )}
            {specSkills.length > 0 && (
              <SkillGroup type="specialization" skills={specSkills} onRemove={canDelete ? (id => removeSkill.mutate(id)) : undefined} />
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SkillGroup({ type, skills, onRemove }: { 
  type: SkillType; 
  skills: { id: string; skill_name: string; domain: string; custom_domain?: string | null }[]; 
  onRemove?: (id: string) => void;
}) {
  const getDomainLabel = (skill: { domain: string; custom_domain?: string | null }) => {
    if (skill.custom_domain) return skill.custom_domain;
    return SKILL_DOMAIN_LABELS[skill.domain as SkillDomain] || skill.domain;
  };

  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
        {SKILL_TYPE_LABELS[type]} ({skills.length}/{SKILL_TYPE_LIMITS[type].max})
      </p>
      <div className="flex flex-wrap gap-2">
        {skills.map(skill => (
          <Badge key={skill.id} variant="outline" className={`gap-1.5 ${onRemove ? 'pr-1' : ''} ${getSkillTypeColor(type)}`}>
            <Sparkles className="w-3 h-3" />
            <span>{skill.skill_name}</span>
            <span className="text-[9px] opacity-60">({getDomainLabel(skill)})</span>
            {onRemove && (
              <button
                onClick={() => onRemove(skill.id)}
                className="ml-1 p-0.5 rounded hover:bg-destructive/10 transition-colors"
              >
                <Trash2 className="w-3 h-3 text-destructive/70" />
              </button>
            )}
          </Badge>
        ))}
      </div>
    </div>
  );
}
