import { useState, useRef, useMemo } from 'react';
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
  Plus,
} from 'lucide-react';

interface Profile {
  user_id: string;
  full_name: string;
  role: string;
  email: string;
  avatar_url?: string | null;
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
  const [selectorOpen, setSelectorOpen] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Fetch profiles + user_roles for robust recipient selection
  const { data: profiles = [], isLoading: isLoadingProfiles } = useQuery({
    queryKey: ['profiles-and-roles-for-composer'],
    queryFn: async () => {
      const [profilesRes, rolesRes] = await Promise.all([
        supabase.from('profiles').select('user_id, full_name, email, avatar_url'),
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
        avatar_url: p.avatar_url,
      })) as Profile[];
    },
  });

  const leads = useMemo(() => profiles.filter((p) =>
    LEADERSHIP_ROLES.includes(p.role as any)
  ), [profiles]);

  const members = useMemo(() => profiles.filter(
    (p) => !LEADERSHIP_ROLES.includes(p.role as any)
  ), [profiles]);

  // List of profiles excluding current authenticated user
  const selectableProfiles = useMemo(() => {
    return profiles.filter((p) => p.user_id !== user?.id);
  }, [profiles, user]);

  const filteredProfiles = useMemo(() => {
    if (!peopleSearch.trim()) return selectableProfiles;
    const q = peopleSearch.toLowerCase();
    return selectableProfiles.filter((p) =>
      (p.full_name || '').toLowerCase().includes(q) ||
      (p.email || '').toLowerCase().includes(q) ||
      ((ROLE_LABELS[p.role as KryptonRole] || p.role) || '').toLowerCase().includes(q)
    );
  }, [selectableProfiles, peopleSearch]);

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

  const handleSelectAllFiltered = () => {
    const filteredIds = filteredProfiles.map((p) => p.user_id);
    setSelectedUserIds((prev) => Array.from(new Set([...prev, ...filteredIds])));
  };

  const handleClearAllFiltered = () => {
    const filteredIds = filteredProfiles.map((p) => p.user_id);
    setSelectedUserIds((prev) => prev.filter((id) => !filteredIds.includes(id)));
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .filter(Boolean)
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
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
        <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Recipients
        </Label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Button
            type="button"
            variant={audience === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setAudience('all')}
            className="text-xs justify-center font-semibold rounded-xl"
          >
            <Users className="w-3.5 h-3.5 mr-1.5 shrink-0" />
            All Members & Leads
          </Button>
          <Button
            type="button"
            variant={audience === 'members' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setAudience('members')}
            className="text-xs justify-center font-semibold rounded-xl"
          >
            <UserCheck className="w-3.5 h-3.5 mr-1.5 shrink-0" />
            Members Only
          </Button>
          <Button
            type="button"
            variant={audience === 'leads' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setAudience('leads')}
            className="text-xs justify-center font-semibold rounded-xl"
          >
            <Radio className="w-3.5 h-3.5 mr-1.5 shrink-0" />
            Leads Only
          </Button>
          <Button
            type="button"
            variant={audience === 'direct' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setAudience('direct')}
            className="text-xs justify-center font-semibold rounded-xl"
          >
            <Users className="w-3.5 h-3.5 mr-1.5 shrink-0" />
            Specific People {selectedUserIds.length > 0 && `(${selectedUserIds.length})`}
          </Button>
        </div>
      </div>

      {/* Specific People Selection UI */}
      {audience === 'direct' && (
        <div className="p-4 border border-border/80 rounded-2xl bg-card/40 space-y-3.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-foreground">
              Recipient Selection
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectorOpen(true)}
              className="h-8 text-xs font-bold gap-1.5 rounded-xl hover:bg-muted"
            >
              <Plus className="w-3.5 h-3.5" />
              {selectedUserIds.length === 0 ? 'Select Recipients...' : 'Edit Selection'}
            </Button>
          </div>

          {/* Selected Users list */}
          {selectedUserIds.length > 0 ? (
            <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto pr-1">
              {selectedUserIds.map((id) => {
                const p = profiles.find((item) => item.user_id === id);
                if (!p) return null;
                const initials = getInitials(p.full_name);
                return (
                  <Badge
                    key={id}
                    variant="secondary"
                    className="text-[11px] font-semibold gap-1.5 px-2.5 py-1 border border-border/60 rounded-full hover:bg-muted/70 transition-all shadow-xs"
                  >
                    <div className="w-4 h-4 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[8px] font-black shrink-0">
                      {initials}
                    </div>
                    <span className="truncate max-w-[120px]">{p.full_name}</span>
                    <X
                      className="w-3.5 h-3.5 cursor-pointer hover:text-destructive text-muted-foreground ml-0.5"
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
            <div className="py-2 text-center">
              <p className="text-xs text-muted-foreground italic font-medium">
                No recipients selected yet. Click button to browse contacts.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Recipient summary indicator */}
      <div className="text-[11px] font-bold text-muted-foreground/80 px-1">
        Will deliver to <strong className="text-primary tabular-nums">{activeRecipients.length}</strong> recipient(s).
      </div>

      {/* Notification Title */}
      <div className="space-y-1">
        <Label className="text-xs font-bold text-foreground">Title</Label>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Important Team Update or Assessment Schedule"
          className="h-9 text-xs rounded-xl"
        />
      </div>

      {/* Message Textarea + Formatting Toolbar */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-bold text-foreground">Message</Label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowPreview(!showPreview)}
            className="h-6 text-[10px] text-muted-foreground hover:text-foreground font-bold"
          >
            <Eye className="w-3 h-3 mr-1" />
            {showPreview ? 'Hide Preview' : 'Show Preview'}
          </Button>
        </div>

        {/* WhatsApp Formatting Toolbar */}
        <div className="flex items-center gap-1 p-1 bg-muted/40 border border-border rounded-t-xl">
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
          <div className="h-4 w-px bg-border/60 mx-1" />
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
          className="rounded-t-none border-t-0 text-xs rounded-b-xl focus-visible:ring-1"
        />
      </div>

      {/* Live Preview Box */}
      {showPreview && message.trim() && (
        <div className="p-3.5 border border-primary/20 rounded-2xl bg-card/60 space-y-1 animate-in fade-in duration-200">
          <p className="text-[9px] font-extrabold uppercase tracking-wider text-muted-foreground">Formatted Live Preview</p>
          <p className="font-bold text-xs text-foreground">{title || 'Untitled Notification'}</p>
          <WhatsAppText text={message} className="text-xs text-foreground/90 leading-relaxed mt-1" />
        </div>
      )}

      {/* 24-Hour Broadcast Toggle */}
      <div className="flex items-start space-x-2.5 p-3 rounded-2xl border border-border/60 bg-muted/20">
        <Checkbox
          id="24h-broadcast"
          checked={is24hBroadcast}
          onCheckedChange={(checked) => setIs24hBroadcast(!!checked)}
          className="mt-0.5"
        />
        <div className="grid gap-1 leading-none">
          <label
            htmlFor="24h-broadcast"
            className="text-xs font-bold cursor-pointer flex items-center gap-1.5 text-foreground"
          >
            <Clock className="w-3.5 h-3.5 text-amber-500" />
            24-Hour Temporary Broadcast
          </label>
          <p className="text-[10px] text-muted-foreground leading-normal">
            Notification expires and is automatically removed from recipient feeds after 24 hours.
          </p>
        </div>
      </div>

      {/* Send Action Button */}
      <div className="flex justify-end pt-2">
        <Button
          onClick={handleSend}
          disabled={!title.trim() || !message.trim() || activeRecipients.length === 0 || sendTargetedNotification.isPending}
          className="gap-2 px-5 text-xs font-bold uppercase tracking-wider rounded-xl h-9"
        >
          {sendTargetedNotification.isPending ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Sending...
            </>
          ) : (
            <>
              <Send className="w-3.5 h-3.5" />
              Send Notification
            </>
          )}
        </Button>
      </div>

      {/* WhatsApp/Instagram Style Select People Dialog */}
      <Dialog open={selectorOpen} onOpenChange={setSelectorOpen}>
        <DialogContent className="w-[95vw] max-w-lg rounded-2xl p-0 overflow-hidden bg-card border-border shadow-2xl flex flex-col h-[85vh] max-h-[600px]">
          <DialogHeader className="p-4 border-b border-border flex flex-row items-center justify-between bg-muted/10 shrink-0">
            <DialogTitle className="text-sm font-bold flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              Select Contacts
            </DialogTitle>
          </DialogHeader>

          {/* Search bar */}
          <div className="p-3 border-b border-border/60 bg-muted/5 shrink-0 space-y-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={peopleSearch}
                onChange={(e) => setPeopleSearch(e.target.value)}
                placeholder="Search people by name, email, or role..."
                className="pl-9 text-xs h-9 rounded-xl"
              />
            </div>

            {/* Quick Filters */}
            <div className="flex items-center justify-between text-[11px] font-bold text-muted-foreground px-1">
              <span>Matching {filteredProfiles.length} of {selectableProfiles.length} users</span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleSelectAllFiltered}
                  className="text-primary hover:underline"
                >
                  Select All
                </button>
                <span className="w-px h-2.5 bg-border/80" />
                <button
                  type="button"
                  onClick={handleClearAllFiltered}
                  className="text-muted-foreground hover:text-foreground"
                >
                  Clear All
                </button>
              </div>
            </div>
          </div>

          {/* Members list */}
          <ScrollArea className="flex-1 p-3">
            {isLoadingProfiles ? (
              <div className="py-12 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                Loading contacts...
              </div>
            ) : filteredProfiles.length === 0 ? (
              <div className="py-12 text-center text-xs text-muted-foreground">
                No matching team members found.
              </div>
            ) : (
              <div className="space-y-1 pr-1.5">
                {filteredProfiles.map((p) => {
                  const checked = selectedUserIds.includes(p.user_id);
                  const roleLabel = ROLE_LABELS[p.role as KryptonRole] || p.role;
                  const initials = getInitials(p.full_name);
                  return (
                    <div
                      key={p.user_id}
                      onClick={() => toggleSelectUser(p.user_id)}
                      className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer text-xs border border-transparent transition-all select-none ${
                        checked
                          ? 'bg-primary/[0.04] border-primary/20 shadow-xs'
                          : 'hover:bg-muted/50'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        {/* Checkbox indicator */}
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() => toggleSelectUser(p.user_id)}
                          className="rounded-full shrink-0 border-border/80"
                        />
                        {/* Avatar */}
                        <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-extrabold text-xs shrink-0 shadow-xs">
                          {initials}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className={`text-[12px] font-bold truncate ${checked ? 'text-primary' : 'text-foreground'}`}>
                            {p.full_name}
                          </span>
                          <span className="text-[10px] text-muted-foreground/80 font-medium truncate mt-0.5">
                            {roleLabel} {p.email && `• ${p.email}`}
                          </span>
                        </div>
                      </div>
                      {checked && (
                        <div className="w-4 h-4 rounded-full bg-primary text-white flex items-center justify-center shrink-0">
                          <Check className="w-2.5 h-2.5 stroke-[3]" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>

          {/* Sticky footer */}
          <div className="p-4 border-t border-border bg-muted/10 flex items-center justify-between gap-3 shrink-0">
            <div className="flex flex-col">
              <span className="text-xs font-bold text-foreground">
                {selectedUserIds.length} recipients selected
              </span>
              <span className="text-[10px] text-muted-foreground/80 font-medium mt-0.5">
                Temporary one-time recipient group
              </span>
            </div>
            <Button
              size="sm"
              onClick={() => setSelectorOpen(false)}
              className="text-xs font-bold rounded-xl h-8 px-4"
            >
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
