import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Bell, Send, Users, Sparkles, Clock } from 'lucide-react';
import { MemberMonitoringStatus } from '@/hooks/useCentralizedMonitoring';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

interface LeadAlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  members: MemberMonitoringStatus[];
  initialSelectedMemberId?: string | null;
  onSendAlert: (params: {
    recipientIds: string[];
    title: string;
    messagePrefix?: string;
    alertType: string;
    isDailySurveyAlert?: boolean;
    expiryHours?: number;
  }) => Promise<void>;
}

export function LeadAlertModal({ isOpen, onClose, members, initialSelectedMemberId, onSendAlert }: LeadAlertModalProps) {
  const [filterTarget, setFilterTarget] = useState<string>(initialSelectedMemberId ? 'selected' : 'missing');
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>(
    initialSelectedMemberId ? [initialSelectedMemberId] : []
  );
  const [title, setTitle] = useState('⚠️ Requirement Action Needed');
  const [messagePrefix, setMessagePrefix] = useState('Please achieve your daily targets.');
  const [isDailySurveyAlert, setIsDailySurveyAlert] = useState(false);
  const [expiryHours, setExpiryHours] = useState<number>(24);
  const [isSending, setIsSending] = useState(false);

  // Compute recipient list based on filter
  const getRecipientIds = (): string[] => {
    if (filterTarget === 'all') return members.map((m) => m.userId);
    if (filterTarget === 'missing') return members.filter((m) => !m.overallMet).map((m) => m.userId);
    if (filterTarget === 'ap_missing') return members.filter((m) => !m.ap.isMet).map((m) => m.userId);
    if (filterTarget === 'ps_missing') return members.filter((m) => !m.ps.isMet).map((m) => m.userId);
    if (filterTarget === 'survey_missing') return members.filter((m) => !m.dailySurvey.isMet).map((m) => m.userId);
    if (filterTarget === 'selected') return selectedMemberIds;
    return [];
  };

  const handleToggleMember = (userId: string) => {
    setSelectedMemberIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const recipientIds = getRecipientIds();
    if (recipientIds.length === 0) return;

    setIsSending(true);
    try {
      await onSendAlert({
        recipientIds,
        title,
        messagePrefix,
        alertType: isDailySurveyAlert ? 'daily_survey_alert' : 'general_requirement_alert',
        isDailySurveyAlert,
        expiryHours,
      });
      onClose();
    } finally {
      setIsSending(false);
    }
  };

  const recipientCount = getRecipientIds().length;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[540px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold">
            <Bell className="w-5 h-5 text-amber-500" />
            Send Personalized Lead Requirement Alert
          </DialogTitle>
          <DialogDescription>
            Alerts automatically attach exact missing numbers for each specific member (e.g. Needs 1200 AP, Needs 2 Survey responses).
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* Target Filter Selection */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Target Audience</Label>
            <Select value={filterTarget} onValueChange={setFilterTarget}>
              <SelectTrigger>
                <SelectValue placeholder="Select target group" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="missing">All Missing Members ({members.filter((m) => !m.overallMet).length})</SelectItem>
                <SelectItem value="survey_missing">Daily Survey Missing ({members.filter((m) => !m.dailySurvey.isMet).length})</SelectItem>
                <SelectItem value="ps_missing">PS Missing ({members.filter((m) => !m.ps.isMet).length})</SelectItem>
                <SelectItem value="ap_missing">AP Missing ({members.filter((m) => !m.ap.isMet).length})</SelectItem>
                <SelectItem value="all">All Members ({members.length})</SelectItem>
                <SelectItem value="selected">Custom Select Members ({selectedMemberIds.length})</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Custom Member Selection List */}
          {filterTarget === 'selected' && (
            <div className="space-y-2 border rounded-lg p-3 bg-muted/30">
              <Label className="text-xs font-semibold text-muted-foreground">Select Individual Members:</Label>
              <ScrollArea className="h-[140px] pr-2">
                <div className="space-y-2">
                  {members.map((m) => (
                    <div key={m.userId} className="flex items-center justify-between p-1.5 rounded hover:bg-muted/50 text-sm">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id={`member-${m.userId}`}
                          checked={selectedMemberIds.includes(m.userId)}
                          onCheckedChange={() => handleToggleMember(m.userId)}
                        />
                        <label htmlFor={`member-${m.userId}`} className="cursor-pointer font-medium">
                          {m.fullName}
                        </label>
                      </div>
                      <Badge variant={m.overallMet ? 'outline' : 'destructive'} className="text-[10px]">
                        {m.overallMet ? 'Met' : 'Missing'}
                      </Badge>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Title Input */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Alert Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>

          {/* Message Prefix */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Message Note (Prefix)</Label>
            <Textarea
              value={messagePrefix}
              onChange={(e) => setMessagePrefix(e.target.value)}
              rows={2}
              placeholder="e.g. Please submit your updates before deadline."
              required
            />
          </div>

          {/* Notification Expiry Duration Controls (24 Hours vs 48 Hours) */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold uppercase tracking-wider flex items-center gap-1 text-foreground">
              <Clock className="w-3.5 h-3.5 text-amber-500" /> Disappearance Period
            </Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setExpiryHours(24)}
                className={`py-2 px-3 rounded-lg border text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  expiryHours === 24
                    ? 'bg-amber-500/20 border-amber-500 text-amber-400 shadow-xs'
                    : 'bg-card border-border hover:bg-muted/50 text-muted-foreground'
                }`}
              >
                <span>24 Hours</span>
                {expiryHours === 24 && <Badge variant="secondary" className="text-[9px] px-1 py-0 bg-amber-500/30 text-amber-300">Default</Badge>}
              </button>

              <button
                type="button"
                onClick={() => setExpiryHours(48)}
                className={`py-2 px-3 rounded-lg border text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  expiryHours === 48
                    ? 'bg-amber-500/20 border-amber-500 text-amber-400 shadow-xs'
                    : 'bg-card border-border hover:bg-muted/50 text-muted-foreground'
                }`}
              >
                <span>48 Hours</span>
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Notification automatically disappears after {expiryHours} hours from creation.
            </p>
          </div>

          {/* Dynamic Missing Breakdown Notice */}
          <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
              <Sparkles className="w-3.5 h-3.5" />
              Dynamic User-Specific Missing Numbers Notice
            </div>
            <p className="text-[11px] text-muted-foreground leading-normal">
              Each recipient will automatically receive their custom notification detailing their exact missing values (e.g. Needs 1200 AP, Needs 1 PS entry).
            </p>
          </div>

          {/* Followup Options */}
          <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900">
            <Checkbox
              id="survey-followup"
              checked={isDailySurveyAlert}
              onCheckedChange={(checked) => setIsDailySurveyAlert(!!checked)}
            />
            <div className="space-y-0.5 text-xs">
              <label htmlFor="survey-followup" className="font-semibold text-amber-900 dark:text-amber-300 cursor-pointer">
                Daily Survey Alert (Actionable Follow-Up)
              </label>
              <p className="text-muted-foreground">
                If checked, sends push alert with [Completed] / [Not Yet] actionable buttons. Each [Completed] click = +1 Survey Response.
              </p>
            </div>
          </div>

          <DialogFooter className="pt-2 flex items-center justify-between sm:justify-between">
            <Badge variant="secondary" className="gap-1 text-xs">
              <Users className="w-3 h-3" />
              {recipientCount} Recipient(s)
            </Badge>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onClose} disabled={isSending}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSending || recipientCount === 0} className="gap-2 bg-amber-600 hover:bg-amber-700 text-white font-bold">
                <Send className="w-4 h-4" />
                {isSending ? 'Sending...' : 'Send Alert'}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
