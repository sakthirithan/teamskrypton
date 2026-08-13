import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, Clock, Send, ShieldCheck, Sparkles, Users } from 'lucide-react';
import { MemberMonitoringStatus } from '@/hooks/useCentralizedMonitoring';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

interface ScheduleAlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  members: MemberMonitoringStatus[];
  onScheduleAlert: (params: {
    title: string;
    message: string;
    target_filter: string;
    target_user_ids?: string[];
    scheduled_at: string;
  }) => Promise<void>;
}

export function ScheduleSurveyAlertModal({ isOpen, onClose, members, onScheduleAlert }: ScheduleAlertModalProps) {
  const [title, setTitle] = useState('⏰ Scheduled Daily Survey Reminder');
  const [message, setMessage] = useState('Please complete today\'s Daily Survey before the 6:30 PM deadline.');
  const [targetFilter, setTargetFilter] = useState('missing_survey');
  const [scheduledDate, setScheduledDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [scheduledTime, setScheduledTime] = useState('18:30');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scheduledDate || !scheduledTime) return;

    setIsSubmitting(true);
    try {
      const scheduledAtIso = new Date(`${scheduledDate}T${scheduledTime}:00`).toISOString();
      await onScheduleAlert({
        title,
        message,
        target_filter: targetFilter,
        scheduled_at: scheduledAtIso,
      });
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const recipientCount = useMemo(() => {
    if (targetFilter === 'missing_survey') return members.filter((m) => !m.dailySurvey.isMet).length;
    if (targetFilter === 'missing_all') return members.filter((m) => !m.overallMet).length;
    return members.length;
  }, [members, targetFilter]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] backdrop-blur-xl bg-card/95 border border-purple-500/30">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-extrabold text-foreground">
            <Clock className="w-5 h-5 text-purple-500" />
            Schedule Daily Survey Alert
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Configure automated, idempotent scheduled notifications that deep-link directly to the Daily Survey.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* Target Audience */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold uppercase tracking-wider">Target Recipients</Label>
            <Select value={targetFilter} onValueChange={setTargetFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Select Target Group" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="missing_survey">Members Missing Daily Survey ({members.filter((m) => !m.dailySurvey.isMet).length})</SelectItem>
                <SelectItem value="missing_all">All Incomplete Members ({members.filter((m) => !m.overallMet).length})</SelectItem>
                <SelectItem value="all">All Eligible Members ({members.length})</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Alert Title */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold uppercase tracking-wider">Notification Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>

          {/* Alert Message */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold uppercase tracking-wider">Message Content</Label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              placeholder="Reminder message for recipients..."
              required
            />
          </div>

          {/* Date & Time Picker */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-primary" /> Date
              </Label>
              <Input
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-primary" /> Time
              </Label>
              <Input
                type="time"
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Idempotent Safety Notice */}
          <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 text-xs flex items-center gap-2 text-purple-300">
            <ShieldCheck className="w-4 h-4 shrink-0 text-purple-400" />
            <span>Idempotency Protection Active: Duplicate notifications are automatically prevented.</span>
          </div>

          <DialogFooter className="pt-2 flex items-center justify-between">
            <Badge variant="secondary" className="gap-1 font-mono text-xs">
              <Users className="w-3 h-3" /> {recipientCount} Recipient(s)
            </Badge>

            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting} className="gap-2 bg-purple-600 hover:bg-purple-700 text-white font-bold">
                <Send className="w-4 h-4" />
                {isSubmitting ? 'Scheduling...' : 'Confirm Schedule'}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
