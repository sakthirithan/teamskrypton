import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Trash2, Pencil, Sparkles, GraduationCap } from 'lucide-react';
import { 
  useMemberSkills, 
  SKILL_TYPE_LABELS, 
  SKILL_TYPE_LIMITS, 
  DOMAIN_OPTIONS,
  SKILL_TO_DOMAIN_MAP,
  getEffectiveDomain,
  SkillType, 
  SkillDomain,
  MemberSkill 
} from '@/hooks/useMemberSkills';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

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
  const { toast } = useToast();
  const { skills, getByType, canAdd, assignSkill, updateSkill, removeSkill } = useMemberSkills(userId);
  const [isOpen, setIsOpen] = useState(false);
  const [editingSkill, setEditingSkill] = useState<MemberSkill | null>(null);
  const [skillName, setSkillName] = useState('');
  const [skillType, setSkillType] = useState<SkillType>('primary');
  const [domain, setDomain] = useState<string>('General');
  const [customDomain, setCustomDomain] = useState('');

  // Leadership can edit & delete skills
  const canEdit = isLeadership;
  const canDelete = isLeadership;
  // Users can create if they have no skills yet; leadership can always create
  const canCreate = isLeadership || (isSelfMode && (skills.length >= 0 && skills.length <= 5 ));

  const resetForm = () => {
    setEditingSkill(null);
    setSkillName('');
    setSkillType('primary');
    setDomain('General');
    setCustomDomain('');
  };

  const handleOpenAssign = () => {
    resetForm();
    setIsOpen(true);
  };

  const handleOpenEdit = (skill: MemberSkill) => {
    if (!canEdit) return;
    setEditingSkill(skill);
    setSkillName(skill.skill_name);
    setSkillType(skill.skill_type);
    if (skill.custom_domain) {
      setDomain('custom');
      setCustomDomain(skill.custom_domain);
    } else {
      const derived = getEffectiveDomain(skill.skill_name, skill.domain, skill.custom_domain);
      setDomain(derived);
      setCustomDomain('');
    }
    setIsOpen(true);
  };

  const handleSkillNameChange = (name: string) => {
    setSkillName(name);
    // Auto detect domain for predefined skills if not editing custom domain
    if (domain !== 'custom') {
      const normalized = name.trim().toLowerCase();
      if (SKILL_TO_DOMAIN_MAP[normalized]) {
        setDomain(SKILL_TO_DOMAIN_MAP[normalized]);
      }
    }
  };

  const canSelectType = (type: SkillType) => {
    if (editingSkill && editingSkill.skill_type === type) {
      return true;
    }
    const otherSkillsCount = skills.filter(s => s.skill_type === type && s.id !== editingSkill?.id).length;
    return otherSkillsCount < SKILL_TYPE_LIMITS[type].max;
  };

  const handleSave = async () => {
    const trimmedName = skillName.trim();
    if (!trimmedName) return;
    if (domain === 'custom' && !customDomain.trim()) return;

    // Check duplicate skill name (case-insensitive) excluding current editing skill
    const isDuplicate = skills.some(
      s => s.id !== editingSkill?.id && s.skill_name.toLowerCase() === trimmedName.toLowerCase()
    );
    if (isDuplicate) {
      toast({
        variant: 'destructive',
        title: 'Duplicate Skill',
        description: `Skill "${trimmedName}" is already assigned to this member.`,
      });
      return;
    }

    if (!canSelectType(skillType)) {
      toast({
        variant: 'destructive',
        title: 'Limit Exceeded',
        description: `Cannot set to ${SKILL_TYPE_LABELS[skillType]}. Maximum limit of ${SKILL_TYPE_LIMITS[skillType].max} reached.`,
      });
      return;
    }

    const finalDomain = domain === 'custom' ? 'General' : domain;
    const finalCustomDomain = domain === 'custom' ? customDomain.trim() : null;

    if (editingSkill) {
      // Edit existing skill
      await updateSkill.mutateAsync({
        id: editingSkill.id,
        user_id: userId,
        skill_name: trimmedName,
        skill_type: skillType,
        domain: finalDomain as any,
        custom_domain: finalCustomDomain,
      });
    } else {
      // Assign new skill
      await assignSkill.mutateAsync({
        user_id: userId,
        skill_name: trimmedName,
        skill_type: skillType,
        domain: finalDomain as any,
        custom_domain: finalCustomDomain || undefined,
        assigned_by: user?.id,
      });
    }

    resetForm();
    setIsOpen(false);
  };

  const primarySkills = getByType('primary');
  const secondarySkills = getByType('secondary');
  const specSkills = getByType('specialization');

  const isPending = assignSkill.isPending || updateSkill.isPending;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-base">
            <GraduationCap className="w-4 h-4 text-primary" />
            Skills — {isSelfMode ? 'My Skills' : userName}
          </span>
          {canCreate && (
            <Button size="sm" variant="outline" onClick={handleOpenAssign}>
              <Plus className="w-4 h-4 mr-1" />
              {isSelfMode ? 'Add Skill' : 'Assign'}
            </Button>
          )}

          <Dialog open={isOpen} onOpenChange={(open) => {
            setIsOpen(open);
            if (!open) resetForm();
          }}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingSkill 
                    ? `Edit Skill for ${userName}` 
                    : isSelfMode ? 'Add Your Skill' : `Assign Skill to ${userName}`}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Skill Name</Label>
                  <Input
                    value={skillName}
                    onChange={e => handleSkillNameChange(e.target.value)}
                    placeholder="e.g., Digital Signal Processing, React, UI Design"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Skill Type</Label>
                  <Select value={skillType} onValueChange={v => setSkillType(v as SkillType)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(['primary', 'secondary', 'specialization'] as SkillType[]).map(type => {
                        const count = skills.filter(s => s.skill_type === type && s.id !== editingSkill?.id).length;
                        const disabled = !canSelectType(type);
                        return (
                          <SelectItem key={type} value={type} disabled={disabled}>
                            {SKILL_TYPE_LABELS[type]} ({count}/{SKILL_TYPE_LIMITS[type].max})
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Domain</Label>
                  <Select value={domain} onValueChange={v => setDomain(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-[240px]">
                      {DOMAIN_OPTIONS.map((opt) => (
                        <SelectItem key={opt} value={opt}>{opt}</SelectItem>
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
                      ⚠ Only leadership can manage or remove skills once added.
                    </p>
                  )}
                </div>

                <Button 
                  onClick={handleSave} 
                  className="w-full" 
                  disabled={!skillName.trim() || !canSelectType(skillType) || isPending || (domain === 'custom' && !customDomain.trim())}
                >
                  {isPending 
                    ? (editingSkill ? 'Saving...' : 'Adding...') 
                    : (editingSkill ? 'Save Changes' : isSelfMode ? 'Add Skill' : 'Assign Skill')}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
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
              <SkillGroup 
                type="primary" 
                skills={primarySkills} 
                onEdit={canEdit ? handleOpenEdit : undefined}
                onRemove={canDelete ? (id => removeSkill.mutate(id)) : undefined} 
              />
            )}
            {secondarySkills.length > 0 && (
              <SkillGroup 
                type="secondary" 
                skills={secondarySkills} 
                onEdit={canEdit ? handleOpenEdit : undefined}
                onRemove={canDelete ? (id => removeSkill.mutate(id)) : undefined} 
              />
            )}
            {specSkills.length > 0 && (
              <SkillGroup 
                type="specialization" 
                skills={specSkills} 
                onEdit={canEdit ? handleOpenEdit : undefined}
                onRemove={canDelete ? (id => removeSkill.mutate(id)) : undefined} 
              />
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SkillGroup({ type, skills, onEdit, onRemove }: { 
  type: SkillType; 
  skills: MemberSkill[]; 
  onEdit?: (skill: MemberSkill) => void;
  onRemove?: (id: string) => void;
}) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
        {SKILL_TYPE_LABELS[type]} ({skills.length}/{SKILL_TYPE_LIMITS[type].max})
      </p>
      <div className="flex flex-wrap gap-2">
        {skills.map(skill => (
          <Badge key={skill.id} variant="outline" className={`gap-1.5 ${onRemove || onEdit ? 'pr-1' : ''} ${getSkillTypeColor(type)}`}>
            <Sparkles className="w-3 h-3" />
            <span>{skill.skill_name}</span>
            <span className="text-[9px] opacity-60">({getEffectiveDomain(skill.skill_name, skill.domain, skill.custom_domain)})</span>
            {onEdit && (
              <button
                type="button"
                onClick={() => onEdit(skill)}
                className="ml-1 p-0.5 rounded hover:bg-primary/10 transition-colors"
                title="Edit Skill"
              >
                <Pencil className="w-3 h-3 text-primary/80" />
              </button>
            )}
            {onRemove && (
              <button
                type="button"
                onClick={() => onRemove(skill.id)}
                className="ml-0.5 p-0.5 rounded hover:bg-destructive/10 transition-colors"
                title="Remove Skill"
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
