import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ROLE_LABELS, KryptonRole, LEADERSHIP_ROLES } from '@/lib/constants';
import { ChevronDown, Users, Crown, UserCheck } from 'lucide-react';
import { VISIBLE_PROFILE_OR } from '@/lib/profileVisibility';

interface Member {
  user_id: string;
  full_name: string;
  role: KryptonRole | null;
}

interface TaskAssignmentSelectProps {
  value: string[];
  onChange: (userIds: string[]) => void;
  disabled?: boolean;
}

export function TaskAssignmentSelect({ value, onChange, disabled }: TaskAssignmentSelectProps) {
  const { user, isCaptainOrVice, isLeadership } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const fetchMembers = async () => {
      const nowIso = new Date().toISOString();
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, is_disabled, disabled_until').or(VISIBLE_PROFILE_OR)
        .eq('is_test', false)
        .or(`is_disabled.is.false,is_disabled.is.null,disabled_until.lt.${nowIso}`);
      const { data: roles } = await supabase.from('user_roles').select('user_id, role');
      
      if (profiles && roles) {
        const roleMap = new Map(roles.map(r => [r.user_id, r.role as KryptonRole]));
        const membersWithRoles = profiles.map(p => ({
          user_id: p.user_id,
          full_name: p.full_name,
          role: roleMap.get(p.user_id) || null
        }));
        setMembers(membersWithRoles);
        
        // Auto-select self for team members
        if (!isLeadership && user) {
          onChange([user.id]);
        }
      }
    };
    fetchMembers();
  }, [isLeadership, user]);

  // Get assignable members - Leadership can assign to everyone, team members only to themselves
  const getAssignableMembers = () => {
    if (isLeadership) {
      return members; // All leadership can assign to all members
    }
    // Team members can only assign to themselves
    return members.filter(m => m.user_id === user?.id);
  };

  const assignableMembers = getAssignableMembers();
  const teamMembers = assignableMembers.filter(m => m.role === 'team_member');
  const leads = assignableMembers.filter(m => m.role && LEADERSHIP_ROLES.includes(m.role));

  const toggleMember = (userId: string) => {
    if (value.includes(userId)) {
      onChange(value.filter(id => id !== userId));
    } else {
      onChange([...value, userId]);
    }
  };

  const selectGroup = (group: 'all' | 'team_members' | 'leads') => {
    switch (group) {
      case 'all':
        onChange(assignableMembers.map(m => m.user_id));
        break;
      case 'team_members':
        onChange(teamMembers.map(m => m.user_id));
        break;
      case 'leads':
        onChange(leads.map(m => m.user_id));
        break;
    }
  };

  const clearAll = () => onChange([]);

  const getDisplayText = () => {
    if (value.length === 0) return 'Select members...';
    if (value.length === assignableMembers.length) return `All (${value.length} members)`;
    if (value.length === 1) {
      const member = members.find(m => m.user_id === value[0]);
      return member?.full_name || '1 selected';
    }
    return `${value.length} members selected`;
  };

  // For team members, show a simple read-only display
  if (!isLeadership) {
    const selfMember = members.find(m => m.user_id === user?.id);
    return (
      <div className="w-full p-3 border rounded-md bg-muted/50">
        <div className="flex items-center gap-2">
          <UserCheck className="w-4 h-4 text-muted-foreground" />
          <span className="font-medium">{selfMember?.full_name || 'Yourself'}</span>
          <span className="text-xs text-muted-foreground">(Self-assigned)</span>
        </div>
      </div>
    );
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={isOpen}
          className="w-full justify-between"
          disabled={disabled}
        >
          <span className="truncate">{getDisplayText()}</span>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <div className="p-3 border-b space-y-2">
          <div className="flex flex-wrap gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => selectGroup('all')}
              className="h-9 text-xs touch-target"
            >
              <Users className="w-3 h-3 mr-1" />
              All ({assignableMembers.length})
            </Button>
            {teamMembers.length > 0 && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => selectGroup('team_members')}
                className="h-9 text-xs touch-target"
              >
                <UserCheck className="w-3 h-3 mr-1" />
                Team ({teamMembers.length})
              </Button>
            )}
            {leads.length > 0 && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => selectGroup('leads')}
                className="h-9 text-xs touch-target"
              >
                <Crown className="w-3 h-3 mr-1" />
                Leads ({leads.length})
              </Button>
            )}
          </div>
          {value.length > 0 && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={clearAll}
              className="h-7 text-xs text-muted-foreground"
            >
              Clear selection
            </Button>
          )}
        </div>
        
        <ScrollArea className="h-[250px]">
          <div className="p-2 space-y-1">
            {assignableMembers.map((member) => (
              <div
                key={member.user_id}
                className="flex items-center space-x-2 p-2 rounded hover:bg-muted cursor-pointer"
                onClick={() => toggleMember(member.user_id)}
              >
                <Checkbox
                  checked={value.includes(member.user_id)}
                  onCheckedChange={() => toggleMember(member.user_id)}
                />
                <Label className="flex-1 cursor-pointer">
                  <span className="font-medium">{member.full_name}</span>
                  {member.role && (
                    <span className="text-xs text-muted-foreground ml-2">
                      ({ROLE_LABELS[member.role]})
                    </span>
                  )}
                </Label>
              </div>
            ))}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
