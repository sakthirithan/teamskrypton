import { useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useGroupingNotifications } from '@/hooks/useGroupingNotifications';
import { ROLE_LABELS, KryptonRole } from '@/lib/constants';
import { LEADERSHIP_ROLES } from '@/lib/roles';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { WhatsAppText } from '@/components/ui/whatsapp-text';
import {
  Send,
  Bold,
  Italic,
  Strikethrough,
  Code,
  List,
  ListOrdered,
  Users,
  UserCheck,
  Search,
  X,
  Clock,
  Radio,
  Eye,
  Check,
  Loader2,
} from 'lucide-react';

interface Profile {
  user_id: string;
  full_name: string;
  role: string;
  email: string;
}

export type AudienceType = 'all' | 'members' | 'leads' | 'direct';

interface NotificationComposerProps {
  onSuccess?: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function NotificationComposer({ onSuccess, open, onOpenChange }: NotificationComposerProps) {
  const { user } = useAuth();
  const { sendTargetedNotification } = useGroupingNotifications();

  const [audience, setAudience] = useState<AudienceType>('all');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [is24hBroadcast, setIs24hBroadcast] = useState(false);
  const [peopleSearch, setPeopleSearch] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Fetch profiles + user_roles for robust recipient selection
  const { data: profiles = [], isLoading: isLoadingProfiles } = useQuery({
    queryKey: ['profiles-and-roles-for-composer'],
    queryFn: async () => {
      const [profilesRes, rolesRes] = await Promise.all([
        supabase.from('profiles').select('user_id, full_name, email'),
        supabase.from('user_roles').select('user_id, role'),
      ]);

      if (profilesRes.error) throw profilesRes.error;

      const rolesMap = new Map(
        (rolesRes.data || []).map((r) => [r.user_id, r.role as string])
      );

      return (profilesRes.data || []).map((p) => ({
        user_id: p.user_id,
        full_name: p.full_name || 'Team Member',
        email: p.email || '',
        role: rolesMap.get(p.user_id) || 'team_member',
      })) as Profile[];
    },
  });

  const leads = profiles.filter((p) =>
    LEADERSHIP_ROLES.includes(p.role as any)
  );
  const members = profiles.filter(
    (p) => !LEADERSHIP_ROLES.includes(p.role as any)
  );

  const filteredProfiles = profiles.filter((p) => {
    if (p.user_id === user?.id) return false;
    if (!peopleSearch.trim()) return true;
    const q = peopleSearch.toLowerCase();
    return (
      (p.full_name || '').toLowerCase().includes(q) ||
      (p.email || '').toLowerCase().includes(q)
    );
  });

  // Helper to insert formatting characters around selected text or cursor
  const applyFormatting = (prefix: string, suffix: string = prefix) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentText = message;
    const selected = currentText.substring(start, end);

    let replacement = '';
    if (selected) {
      replacement = `${prefix}${selected}${suffix}`;
    } else {
      replacement = `${prefix}text${suffix}`;
    }

    const newText = currentText.substring(0, start) + replacement + currentText.substring(end);
    setMessage(newText);

    setTimeout(() => {
      textarea.focus();
      const newCursorPos = start + prefix.length + (selected ? selected.length : 4);
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 50);
  };

  const applyListFormatting = (type: 'bullet' | 'numbered') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const prefix = type === 'bullet' ? '- ' : '1. ';
    const start = textarea.selectionStart;
    const currentText = message;

    const newText =
      currentText.substring(0, start) +
      (start > 0 && !currentText.endsWith('\n') ? '\n' : '') +
      prefix +
      currentText.substring(start);
    setMessage(newText);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, start + prefix.length);
    }, 50);
  };

  const toggleSelectUser = (userId: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const resolveRecipientIds = (): string[] => {
    if (audience === 'direct') {
      return selectedUserIds;
    }
    if (audience === 'members') {
      return members.map((p) => p.user_id).filter((id) => id !== user?.id);
    }
    if (audience === 'leads') {
      return leads.map((p) => p.user_id).filter((id) => id !== user?.id);
    }
    // 'all'
    return profiles.map((p) => p.user_id).filter((id) => id !== user?.id);
  };

  const activeRecipients = resolveRecipientIds();

  const handleSend = async () => {
    if (!title.trim()) return;
    if (!message.trim()) return;
    if (activeRecipients.length === 0) return;

    await sendTargetedNotification.mutateAsync({
      recipient_ids: activeRecipients,
      target_audience: audience,
      title: title.trim(),
      message: message.trim(),
      is_24h_broadcast: is24hBroadcast,
    });

    setTitle('');
    setMessage('');
    setSelectedUserIds([]);
    setIs24hBroadcast(false);
    if (onSuccess) onSuccess();
    if (onOpenChange) onOpenChange(false);
  };

  return (
    <div className="space-y-4">
      {/* Target Audience Selector */}
      <div className="space-y-2">
        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Recipients
        </Label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Button
            type="button"
            variant={audience === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setAudience('all')}
            className="text-xs justify-center"
          >
            <Users className="w-3.5 h-3.5 mr-1.5 shrink-0" />
            All Members & Leads
          </Button>
          <Button
            type="button"
            variant={audience === 'members' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setAudience('members')}
            className="text-xs justify-center"
          >
            <UserCheck className="w-3.5 h-3.5 mr-1.5 shrink-0" />
            Members Only
          </Button>
          <Button
            type="button"
            variant={audience === 'leads' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setAudience('leads')}
            className="text-xs justify-center"
          >
            <Radio className="w-3.5 h-3.5 mr-1.5 shrink-0" />
            Leads Only
          </Button>
          <Button
            type="button"
            variant={audience === 'direct' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setAudience('direct')}
            className="text-xs justify-center"
          >
            <Users className="w-3.5 h-3.5 mr-1.5 shrink-0" />
            Specific People {selectedUserIds.length > 0 && `(${selectedUserIds.length})`}
          </Button>
        </div>
      </div>

      {/* Specific People Multi-Select Chips & Selector */}
      {audience === 'direct' && (
        <div className="p-3 border border-border rounded-lg bg-card/60 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-foreground">
              Select Individuals ({selectedUserIds.length} selected)
            </span>
            <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5">
                  <Search className="w-3 h-3" />
                  Browse & Add People
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-80 p-2 shadow-2xl z-50 border-border bg-popover">
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={peopleSearch}
                      onChange={(e) => setPeopleSearch(e.target.value)}
                      placeholder="Search member name or email..."
                      className="h-8 pl-8 text-xs"
                    />
                  </div>

                  <ScrollArea className="h-56">
                    {isLoadingProfiles ? (
                      <div className="p-4 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin text-primary" />
                        Loading people...
                      </div>
                    ) : filteredProfiles.length === 0 ? (
                      <div className="p-4 text-center text-xs text-muted-foreground">
                        No people found.
                      </div>
                    ) : (
                      <div className="space-y-1 pr-2">
                        {filteredProfiles.map((p) => {
                          const checked = selectedUserIds.includes(p.user_id);
                          const roleLabel = ROLE_LABELS[p.role as KryptonRole] || p.role;
                          return (
                            <div
                              key={p.user_id}
                              onClick={() => toggleSelectUser(p.user_id)}
                              className={`flex items-center justify-between p-2 rounded cursor-pointer text-xs transition-colors ${
                                checked
                                  ? 'bg-primary/10 border border-primary/20'
                                  : 'hover:bg-muted/70'
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <Checkbox
                                  checked={checked}
                                  onCheckedChange={() => toggleSelectUser(p.user_id)}
                                />
                                <div className="flex flex-col min-w-0">
                                  <span className={`font-medium truncate ${checked ? 'text-primary font-semibold' : ''}`}>
                                    {p.full_name}
                                  </span>
                                  <span className="text-[10px] text-muted-foreground truncate">
                                    {roleLabel} {p.email && `• ${p.email}`}
                                  </span>
                                </div>
                              </div>
                              {checked && <Check className="w-4 h-4 text-primary shrink-0 ml-2" />}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </ScrollArea>
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {/* Selected Chips */}
          {selectedUserIds.length > 0 ? (
            <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
              {selectedUserIds.map((id) => {
                const p = profiles.find((item) => item.user_id === id);
                return (
                  <Badge
                    key={id}
                    variant="secondary"
                    className="text-[11px] gap-1 px-2 py-0.5 border border-border"
                  >
                    <span>{p?.full_name || 'User'}</span>
                    <X
                      className="w-3 h-3 cursor-pointer hover:text-destructive text-muted-foreground ml-0.5"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSelectUser(id);
                      }}
                    />
                  </Badge>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic">No individuals selected yet.</p>
          )}
        </div>
      )}

      {/* Recipient summary indicator */}
      <div className="text-[11px] text-muted-foreground">
        Will deliver to <strong className="text-foreground">{activeRecipients.length}</strong> recipient(s).
      </div>

      {/* Notification Title */}
      <div className="space-y-1">
        <Label className="text-xs font-semibold">Title</Label>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Important Team Update or Assessment Schedule"
          className="h-9 text-sm"
        />
      </div>

      {/* Message Textarea + Formatting Toolbar */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-semibold">Message (WhatsApp Formatting Supported)</Label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowPreview(!showPreview)}
            className="h-6 text-[11px] text-muted-foreground hover:text-foreground"
          >
            <Eye className="w-3 h-3 mr-1" />
            {showPreview ? 'Hide Preview' : 'Show Preview'}
          </Button>
        </div>

        {/* WhatsApp Formatting Toolbar */}
        <div className="flex items-center gap-1 p-1 bg-muted/50 border border-border rounded-t-md">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => applyFormatting('*')}
            className="h-7 w-7"
            title="Bold (*text*)"
          >
            <Bold className="w-3.5 h-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => applyFormatting('_')}
            className="h-7 w-7"
            title="Italic (_text_)"
          >
            <Italic className="w-3.5 h-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => applyFormatting('~')}
            className="h-7 w-7"
            title="Strikethrough (~text~)"
          >
            <Strikethrough className="w-3.5 h-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => applyFormatting('`')}
            className="h-7 w-7"
            title="Monospace (`code`)"
          >
            <Code className="w-3.5 h-3.5" />
          </Button>
          <div className="h-4 w-px bg-border mx-1" />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => applyListFormatting('bullet')}
            className="h-7 w-7"
            title="Bullet list (- item)"
          >
            <List className="w-3.5 h-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => applyListFormatting('numbered')}
            className="h-7 w-7"
            title="Numbered list (1. item)"
          >
            <ListOrdered className="w-3.5 h-3.5" />
          </Button>
        </div>

        <Textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Type your formatted message here... (e.g. *Important Notice*: Complete ~yesterday's~ task _today_.)"
          rows={4}
          className="rounded-t-none border-t-0 text-sm focus-visible:ring-1"
        />
      </div>

      {/* Live Preview Box */}
      {showPreview && message.trim() && (
        <div className="p-3 border border-primary/20 rounded-md bg-card/80 space-y-1 animate-in fade-in duration-200">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Formatted Live Preview</p>
          <p className="font-semibold text-sm">{title || 'Untitled Notification'}</p>
          <WhatsAppText text={message} className="text-sm text-foreground/90" />
        </div>
      )}

      {/* 24-Hour Broadcast Toggle */}
      <div className="flex items-center space-x-2 p-2.5 rounded-lg border border-border/60 bg-muted/30">
        <Checkbox
          id="24h-broadcast"
          checked={is24hBroadcast}
          onCheckedChange={(checked) => setIs24hBroadcast(!!checked)}
        />
        <div className="grid gap-0.5 leading-none">
          <label
            htmlFor="24h-broadcast"
            className="text-xs font-semibold cursor-pointer flex items-center gap-1.5"
          >
            <Clock className="w-3.5 h-3.5 text-amber-500" />
            24-Hour Temporary One-Time Broadcast
          </label>
          <p className="text-[11px] text-muted-foreground">
            Notification remains active in recipient feeds for 24 hours before automatically expiring.
          </p>
        </div>
      </div>

      {/* Send Action Button */}
      <div className="flex justify-end pt-2">
        <Button
          onClick={handleSend}
          disabled={!title.trim() || !message.trim() || activeRecipients.length === 0 || sendTargetedNotification.isPending}
          className="gap-2 px-5"
        >
          <Send className="w-4 h-4" />
          {sendTargetedNotification.isPending ? 'Sending...' : 'Send Notification'}
        </Button>
      </div>
    </div>
  );
}
