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
    recipient_id: '',
    title: '',
    message: '',
    type: 'info',
  });

  const { data: profiles } = useQuery({
    queryKey: ['all-profiles-for-notif'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .order('full_name');
      if (error) throw error;
      return data || [];
    },
  });

  const handleSend = async () => {
    if (!form.recipient_id || !form.title) return;
    await sendNotification.mutateAsync({
      recipient_id: form.recipient_id,
      title: form.title,
      message: form.message || undefined,
      type: form.type,
      session_id: activeSession?.id,
    });
    setForm({ recipient_id: '', title: '', message: '', type: 'info' });
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
          <div className="space-y-2">
            <Label>Recipient</Label>
            <Select value={form.recipient_id} onValueChange={(v) => setForm({ ...form, recipient_id: v })}>
              <SelectTrigger>
                <SelectValue placeholder="Select member" />
              </SelectTrigger>
              <SelectContent>
                {(profiles || []).map((p) => (
                  <SelectItem key={p.user_id} value={p.user_id}>
                    {p.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Type</Label>
            <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
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
          <div className="space-y-2">
            <Label>Title</Label>
            <Input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Notification title"
            />
          </div>
          <div className="space-y-2">
            <Label>Message (optional)</Label>
            <Textarea
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
              placeholder="Detailed message..."
              rows={3}
            />
          </div>
          <Button
            onClick={handleSend}
            className="w-full"
            disabled={sendNotification.isPending || !form.recipient_id || !form.title}
          >
            {sendNotification.isPending ? 'Sending...' : 'Send Notification'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
