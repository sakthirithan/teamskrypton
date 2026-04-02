import { useState } from 'react';
import { Send } from 'lucide-react';
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

  // 🔥 Fetch profiles + roles
  const { data: profiles } = useQuery({
    queryKey: ['all-profiles-for-notif'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          user_id,
          full_name,
          user_roles (role)
        `);

      if (error) throw error;
      return data || [];
    },
  });

  const allUsers = profiles || [];

  const leadRoles = [
    'team_captain',
    'vice_captain',
    'team_manager',
    'strategist',
  ];

  const leads = allUsers.filter((p: any) =>
    leadRoles.includes(p.user_roles?.role)
  );

  const members = allUsers.filter(
    (p: any) => !leadRoles.includes(p.user_roles?.role)
  );

  // ✅ Send to multiple users
  const handleSend = async () => {
    if (form.recipient_ids.length === 0 || !form.title) return;

    await Promise.all(
      form.recipient_ids.map((id) =>
        sendNotification.mutateAsync({
          recipient_id: id,
          title: form.title,
          message: form.message || undefined,
          type: form.type,
          session_id: activeSession?.id,
        })
      )
    );

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
            <div className="flex gap-2 flex-wrap">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  setForm({
                    ...form,
                    recipient_ids: allUsers.map((u: any) => u.user_id),
                  })
                }
              >
                All
              </Button>

              {/* <Button
                type="button"
                size="sm"
                variant="outline"
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
                onClick={() =>
                  setForm({
                    ...form,
                    recipient_ids: members.map((u: any) => u.user_id),
                  })
                }
              >
                Members
              </Button> */}
              <Button
                type="button"
                size="sm"
                variant="destructive"
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

            {/* Manual Multi Select */}
            <div className="max-h-40 overflow-y-auto border rounded-md p-2 space-y-1">
              {allUsers.map((p: any) => {
                const selected = form.recipient_ids.includes(p.user_id);

                return (
                  <div
                    key={p.user_id}
                    className="flex items-center gap-2 cursor-pointer hover:bg-muted px-1 rounded"
                    onClick={() => {
                      setForm({
                        ...form,
                        recipient_ids: selected
                          ? form.recipient_ids.filter((id) => id !== p.user_id)
                          : [...form.recipient_ids, p.user_id],
                      });
                    }}
                  >
                    <input type="checkbox" checked={selected} readOnly />
                    <span className="text-sm">{p.full_name}</span>
                  </div>
                );
              })}
            </div>

            {/* Selected count */}
            <p className="text-xs text-muted-foreground">
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