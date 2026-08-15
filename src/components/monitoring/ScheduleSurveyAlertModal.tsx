import { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, Send, ShieldCheck, Users, Search, X } from 'lucide-react';
import { MemberMonitoringStatus } from '@/hooks/useCentralizedMonitoring';
import { format } from 'date-fns';

interface ScheduleAlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  members: MemberMonitoringStatus[];
  initialSelectedMemberIds?: string[];
  onScheduleAlert: (params: {
    title: string;
    message: string;
    target_filter: string;
    target_user_ids?: string[];
    scheduled_at: string;
  }) => Promise<void>;
}

export function ScheduleSurveyAlertModal({
  isOpen,
  onClose,
  members,
  initialSelectedMemberIds = [],
  onScheduleAlert,
}: ScheduleAlertModalProps) {
  const [title, setTitle] = useState('Complete your daily targets, then take the Daily Survey');
  const [message, setMessage] = useState('Please complete your remaining daily requirements before the deadline.');
  const [targetFilter, setTargetFilter] = useState('missing_survey');
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [scheduledDate, setScheduledDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [scheduledTime, setScheduledTime] = useState('18:30');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showMemberSelector, setShowMemberSelector] = useState(false);

  const initialKey = initialSelectedMemberIds.join(',');

  useEffect(() => {
    if (isOpen) {
      if (initialSelectedMemberIds.length > 0) {
        setTargetFilter('selected');
        setSelectedMemberIds([...initialSelectedMemberIds]);
      } else {
        setTargetFilter('missing_survey');
        setSelectedMemberIds([]);
      }
      setShowMemberSelector(false);
    }
  }, [isOpen, initialKey]);

  const filteredMembers = useMemo(() => {
    return members.filter(
      (m) =>
        !memberSearchQuery ||
        m.fullName.toLowerCase().includes(memberSearchQuery.toLowerCase()) ||
        m.department.toLowerCase().includes(memberSearchQuery.toLowerCase())
    );
  }, [members, memberSearchQuery]);

  const recipientIds = useMemo(() => {
    if (targetFilter === 'missing_survey') return members.filter((m) => !m.dailySurvey.isMet).map((m) => m.userId);
    if (targetFilter === 'missing_all') return members.filter((m) => !m.overallMet).map((m) => m.userId);
    if (targetFilter === 'all') return members.map((m) => m.userId);
    if (targetFilter === 'selected' || targetFilter === 'individual') return selectedMemberIds;
    return [];
  }, [members, targetFilter, selectedMemberIds]);

  const recipientCount = recipientIds.length;

  const handleToggleMember = (userId: string) => {
    if (targetFilter === 'individual') {
      setSelectedMemberIds([userId]);
    } else {
      setSelectedMemberIds((prev) =>
        prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
      );
    }
  };

  const handleRemoveChip = (userId: string) => {
    setSelectedMemberIds((prev) => prev.filter((id) => id !== userId));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scheduledDate || !scheduledTime || recipientCount === 0) return;

    setIsSubmitting(true);
    try {
      const scheduledAtIso = new Date(`${scheduledDate}T${scheduledTime}:00`).toISOString();
      await onScheduleAlert({
        title,
        message,
        target_filter: targetFilter,
        target_user_ids: (targetFilter === 'selected' || targetFilter === 'individual') ? recipientIds : [],
        scheduled_at: scheduledAtIso,
      });
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] backdrop-blur-xl bg-card/95 border border-purple-500/30 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-extrabold text-foreground">
            <Clock className="w-5 h-5 text-purple-500" />
            Schedule Daily Survey Alert
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Configure automated, idempotent scheduled notifications that deep-link directly to Take Survey.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* Target Audience */}
          <div className="space-y-2 p-3 rounded-xl border bg-muted/20">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-purple-400" /> Target Recipients
              </Label>
              {(targetFilter === 'selected' || targetFilter === 'individual') && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[10px] text-purple-400 hover:text-purple-300 font-bold"
                  onClick={() => setShowMemberSelector(!showMemberSelector)}
                >
                  {showMemberSelector ? 'Hide Selector' : '+ Change Recipients'}
                </Button>
              )}
            </div>

            <Select
              value={targetFilter}
              onValueChange={(val) => {
                setTargetFilter(val);
                if (val === 'selected' || val === 'individual') {
                  setShowMemberSelector(true);
                } else {
                  setShowMemberSelector(false);
                }
              }}
            >
              <SelectTrigger className="h-8 text-xs bg-background">
                <SelectValue placeholder="Select Target Group" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="missing_survey">Members Missing Daily Survey ({members.filter((m) => !m.dailySurvey.isMet).length})</SelectItem>
                <SelectItem value="missing_all">All Incomplete Members ({members.filter((m) => !m.overallMet).length})</SelectItem>
                <SelectItem value="all">All Eligible Members ({members.length})</SelectItem>
                <SelectItem value="individual">Individual Member</SelectItem>
                <SelectItem value="selected">Multiple Specific Members ({selectedMemberIds.length})</SelectItem>
              </SelectContent>
            </Select>

            {/* Pre-selected Recipient Chips */}
            {(targetFilter === 'selected' || targetFilter === 'individual') && selectedMemberIds.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap pt-1">
                {selectedMemberIds.map((uid) => {
                  const m = members.find((mem) => mem.userId === uid);
                  if (!m) return null;
                  return (
                    <Badge
                      key={uid}
                      variant="secondary"
                      className="gap-1 text-[10px] font-semibold bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2 py-0.5"
                    >
                      <span>{m.fullName}</span>
                      <X
                        className="w-3 h-3 cursor-pointer hover:text-white"
                        onClick={() => handleRemoveChip(uid)}
                      />
                    </Badge>
                  );
                })}
              </div>
            )}

            {/* Searchable Member Selector List */}
            {(targetFilter === 'selected' || targetFilter === 'individual' || showMemberSelector) && (
              <div className="space-y-2 pt-1 border-t border-border/40">
                <div className="relative">
                  <Search className="w-3 h-3 absolute left-2.5 top-2.5 text-muted-foreground" />
                  <Input
                    placeholder="Search member name or dept..."
                    value={memberSearchQuery}
                    onChange={(e) => setMemberSearchQuery(e.target.value)}
                    className="pl-7 h-7 text-xs bg-background"
                  />
                </div>

                <ScrollArea className="h-32 border rounded-lg p-2 bg-background">
                  <div className="space-y-1.5">
                    {filteredMembers.map((m) => {
                      const isChecked = selectedMemberIds.includes(m.userId);
                      return (
                        <div
                          key={m.userId}
                          onClick={() => handleToggleMember(m.userId)}
                          className={`flex items-center justify-between p-1.5 rounded cursor-pointer transition-colors ${
                            isChecked ? 'bg-purple-500/20 border-purple-500/50' : 'hover:bg-muted/50'
                          }`}
                        >
                          <div className="flex items-center gap-2 pointer-events-none">
                            <Checkbox checked={isChecked} tabIndex={-1} />
                            <div>
                              <p className="font-bold text-xs leading-none">{m.fullName}</p>
                              <p className="text-[9px] text-muted-foreground">{m.department}</p>
                            </div>
                          </div>
                          <Badge variant="outline" className="text-[9px] pointer-events-none">
                            {m.role.replace('_', ' ')}
                          </Badge>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              </div>
            )}
          </div>

          {/* Alert Title */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold uppercase tracking-wider">Notification Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} required className="h-8 text-xs" />
          </div>

          {/* Alert Message */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold uppercase tracking-wider">Message Content</Label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={2}
              placeholder="Reminder message for recipients..."
              required
              className="text-xs"
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
                className="h-8 text-xs"
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
                className="h-8 text-xs"
              />
            </div>
          </div>

          {/* Retention & Idempotent Safety Notice */}
          <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-[11px] flex items-center gap-2 text-purple-300">
            <ShieldCheck className="w-4 h-4 shrink-0 text-purple-400" />
            <span>24-Hour Expiry Active: Notifications disappear automatically after 1 day.</span>
          </div>

          <DialogFooter className="pt-2 flex items-center justify-between">
            <Badge variant="secondary" className="gap-1 font-mono text-xs">
              <Users className="w-3 h-3" /> {recipientCount} Recipient(s)
            </Badge>

            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={isSubmitting || recipientCount === 0} className="gap-1.5 bg-purple-600 hover:bg-purple-700 text-white font-bold">
                <Send className="w-3.5 h-3.5" />
                {isSubmitting ? 'Scheduling...' : 'Confirm Schedule'}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
