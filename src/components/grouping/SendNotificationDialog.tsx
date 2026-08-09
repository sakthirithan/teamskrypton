import { useState } from 'react';
import { Send, Check, Users } from 'lucide-react';
import { LEADERSHIP_ROLES } from '@/lib/roles';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useGroupingNotifications } from '@/hooks/useGroupingNotifications';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useGroupingSessions } from '@/hooks/useGroupingSessions';

interface Props {
  trigger?: React.ReactNode;
}

export function SendNotificationDialog({ trigger }: Props) {
  const [open, setOpen] = useState(false);
  const { sendNotification } = useGroupingNotifications();
  const { activeSession } = useGroupingSessions();

  const [form, setForm] = useState({
    recipient_ids: [] as string[],
    title: '',
    message: '',
    type: 'info',
  });

  // 🔥 Fetch profiles + roles (Fixing the Relation Not Found Bug)
  const { data: profiles } = useQuery({
    queryKey: ['all-profiles-for-notif'],
    queryFn: async () => {
      const [profilesRes, rolesRes] = await Promise.all([
        supabase.from('profiles').select('user_id, full_name'),
        supabase.from('user_roles').select('user_id, role')
      ]);

      if (profilesRes.error) throw profilesRes.error;

      // Extract roles mapping
      const validRoles = rolesRes.data || [];
      const rolesMap = new Map(validRoles.map(r => [r.user_id, r.role]));

      // Map roles back into profile expected shape
      return (profilesRes.data || []).map(p => ({
        user_id: p.user_id,
        full_name: p.full_name,
        user_roles: { role: rolesMap.get(p.user_id) || null }
      }));
    },
  });

  const allUsers = profiles || [];
  const leads = allUsers.filter(u => u.user_roles?.role && LEADERSHIP_ROLES.includes(u.user_roles.role as any));
  const members = allUsers.filter(u => !u.user_roles?.role || !LEADERSHIP_ROLES.includes(u.user_roles.role as any));

  // ✅ Send to multiple users as a private broadcast
  const handleSend = async () => {
    if (form.recipient_ids.length === 0 || !form.title) return;

    await sendTargetedNotification.mutateAsync({
      recipient_ids: form.recipient_ids,
      target_audience: 'direct',
      title: form.title,
      message: form.message || '',
      type: form.type,
      session_id: activeSession?.id,
    });

    // Fire-and-forget email delivery via Gmail connector
    supabase.functions.invoke('send-notification-email', {
      body: {
        recipient_ids: form.recipient_ids,
        title: form.title,
        message: form.message || undefined,
        type: form.type,
      },
    }).catch((err) => console.error('Email dispatch failed:', err));

    setForm({
      recipient_ids: [],
      title: '',
      message: '',
      type: 'info',
    });

    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <Send className="w-3.5 h-3.5 mr-1.5" />
            Send Notification
          </Button>
        )}
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="w-4 h-4" />
            Send Notification
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">

          {/* ✅ Recipients */}
          <div className="space-y-2">
            <Label>Recipients</Label>

            {/* Quick Select Buttons */}
            <div className="flex flex-wrap gap-2 mb-2 p-1.5 bg-card/60 backdrop-blur-md rounded-lg border border-border/40 shadow-sm">
              <span className="text-[11px] font-semibold text-muted-foreground self-center ml-1 select-none">Quick Select:</span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 px-3 text-xs bg-background/50 hover:bg-primary/10 border-border/50 transition-colors rounded-md"
                onClick={() =>
                  setForm({
                    ...form,
                    recipient_ids: allUsers.map((u: any) => u.user_id),
                  })
                }
              >
                All
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 px-3 text-xs bg-background/50 hover:bg-primary/10 border-border/50 transition-colors rounded-md"
                onClick={() =>
                  setForm({
                    ...form,
                    recipient_ids: leads.map((u: any) => u.user_id),
                  })
                }
              >
                Leads
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 px-3 text-xs bg-background/50 hover:bg-primary/10 border-border/50 transition-colors rounded-md"
                onClick={() =>
                  setForm({
                    ...form,
                    recipient_ids: members.map((u: any) => u.user_id),
                  })
                }
              >
                Members
              </Button>
              <div className="flex-1" />
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md"
                onClick={() =>
                  setForm({
                    ...form,
                    recipient_ids: [],
                  })
                }
              >
                Clear
              </Button>
            </div>

            {/* Manual Multi Select (Premium UI) */}
            <div className="max-h-56 overflow-y-auto border border-border/70 rounded-xl p-2 space-y-1 bg-card/40 backdrop-blur-xl shadow-inner scrollbar-thin">
              {allUsers.map((p: any) => {
                const selected = form.recipient_ids.includes(p.user_id);
                const role = p.user_roles?.role?.replace('_', ' ') || 'member';

                return (
                  <div
                    key={p.user_id}
                    onClick={() => {
                      setForm({
                        ...form,
                        recipient_ids: selected
                          ? form.recipient_ids.filter((id) => id !== p.user_id)
                          : [...form.recipient_ids, p.user_id],
                      });
                    }}
                    className={`flex items-center justify-between py-1.5 px-2.5 rounded-md cursor-pointer transition-all duration-200 border ${
                      selected 
                        ? 'bg-primary/10 border-primary/20' 
                        : 'bg-transparent border-transparent hover:bg-secondary/60'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`text-[13px] ${selected ? 'font-semibold text-primary' : 'font-medium text-foreground'}`}>
                        {p.full_name}
                      </span>
                      <span className={`text-[9px] uppercase tracking-wider ${selected ? 'text-primary/60' : 'text-muted-foreground/50'}`}>
                        {role}
                      </span>
                    </div>
                    {selected ? (
                      <Check className="w-3.5 h-3.5 text-primary animate-in zoom-in duration-200" />
                    ) : (
                      <div className="w-3.5 h-3.5 rounded border border-muted-foreground/30" />
                    )}
                  </div>
                );
              })}
              {allUsers.length === 0 && (
                <div className="p-4 text-center text-sm text-muted-foreground flex flex-col items-center">
                  <Users className="w-8 h-8 mb-2 opacity-50" />
                  No members found to notify.
                </div>
              )}
            </div>

            {/* Selected count */}
            <p className="text-xs font-medium text-muted-foreground mt-1 text-right">
              {form.recipient_ids.length} selected
            </p>
          </div>

          {/* Type */}
          <div className="space-y-2">
            <Label>Type</Label>
            <Select
              value={form.type}
              onValueChange={(v) => setForm({ ...form, type: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="info">Info</SelectItem>
                <SelectItem value="alert">Alert</SelectItem>
                <SelectItem value="warning">Warning</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Title */}
          <div className="space-y-2">
            <Label>Title</Label>
            <Input
              value={form.title}
              onChange={(e) =>
                setForm({ ...form, title: e.target.value })
              }
              placeholder="Notification title"
            />
          </div>

          {/* Message */}
          <div className="space-y-2">
            <Label>Message (optional)</Label>
            <Textarea
              value={form.message}
              onChange={(e) =>
                setForm({ ...form, message: e.target.value })
              }
              placeholder="Detailed message..."
              rows={3}
            />
          </div>

          {/* Send Button */}
          <Button
            onClick={handleSend}
            className="w-full"
            disabled={
              sendNotification.isPending ||
              form.recipient_ids.length === 0 ||
              !form.title
            }
          >
            {sendNotification.isPending
              ? 'Sending...'
              : 'Send Notification'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}